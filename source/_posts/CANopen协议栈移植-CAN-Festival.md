---
title: CANopen协议栈移植(CAN Festival)
date: 2026-08-29 18:08:52
categories:
  - 嵌入式
  - CAN
tags:
  - CAN
---

### 什么是 CAN Festival

CAN Festival 就是一个用纯 C 编写的、开源的 CANopen 主/从站协议栈。由法国 LEC（嵌入式系统实验室）团队早期开发，后来完全开源，适用于在各大嵌入式平台上运行 CANopen 协议栈。其支持 CiA 301（通信行规）和 CiA 402（驱动行规），相比起CANopenNode / MicroCANopen 等主流协议栈，CAN Festival 的代码相对老旧，内存占用较大，且对 64 位数据（如某些位置编码器）的支持不如现代协议栈完善。

虽然新开源栈十分优秀，但是 CAN Festival 依然有一席之地。CAN Festival 的 OD 对象字典设计十分有意思，初见时会觉得很别扭，难以配置，但当熟络之后会发现 CAN Festival 的 OD 字典配置设计是很精妙的，而且全部是**编译期静态分配的全局数组**，没有动态内存分配，这也是它依然被很多老军工、老工业设备固件锁定的核心理由。

### 移植全景

本文主要阐述裸机环境下的 CAN Festival 协议栈（以下简称协议）移植，其移植的核心是协议开放出来的外部接口，协议内部的核心状态机无需改动，也不能够进行改动。

- **硬件 CAN 接口**：由于协议栈无法感知外部具体环境，因此具体的CAN报文收发等低层操作，需要用户根据自身移植环境进行提供。
  具体主要是实现报文发送接口 `canSend()` 以及报文接收接口 `canDispatch()`。以上是在使用 CAN ISR 的前提下我们需要对应实现的接口。同时协议也提供了 `canReceive()` 接口，若使用轮询的方式进行协议状态机推进，则需要实现该接口。
- **定时器接口**：CANopen 内部运转涉及到心跳报文以及超时检测，因此协议中也需要用户提供一个时基来维护协议栈內部状态的正常运转。以 STM32 为例，我们可以将基本定时器 TIM7 配置给协议栈用作时基，并实现 `getElapsedTime()` 以及 `setTimer()` 接口即可。
- **OD字典**：对象字典是 CANopen 的灵魂所在，也是协议比较难以理解的地方。本文只阐述协议的移植步骤，因此会提供一份配置好的主/从机 OD 字典框架。关于字典的配置，在相关文章中再详细进行阐述。

### 协议移植

#### CAN 接口

首先应确保底层 CAN 被正确配置，这是协议运作的根基，很多时候移植好了却发不出去，抓不到波形，多半就是底层传输没跑通。

这里以 STM32F407VET6 为例子，配置 CAN1 作为本次移植的底层传输 CAN 控制外设。

```c
static CAN_HandleTypeDef hcan;
static CAN_FilterTypeDef hfilter;

void 
HX_CAN_Init( void )
{
	__HAL_RCC_CAN1_CLK_ENABLE();
	CAN_GPIO_CLK_EN();	// do { __HAL_RCC_GPIOA_CLK_ENABLE(); } while(0)

	GPIO_InitTypeDef can_gpio;
	can_gpio.Alternate = GPIO_AF9_CAN1;
	can_gpio.Mode = GPIO_MODE_AF_PP;
	can_gpio.Pin = CAN_TX_PIN | CAN_RX_PIN;
	can_gpio.Pull = GPIO_PULLUP;
	can_gpio.Speed = GPIO_SPEED_FREQ_HIGH;

	HAL_GPIO_Init( GPIOA, &can_gpio );

	hcan.Instance = CAN1;
	hcan.Init.AutoBusOff = DISABLE;
	hcan.Init.AutoRetransmission = ENABLE;
	hcan.Init.AutoWakeUp = DISABLE;

	hcan.Init.Mode = CAN_MODE_LOOPBACK;
	hcan.Init.SyncJumpWidth = CAN_SJW_1TQ;
	hcan.Init.ReceiveFifoLocked = DISABLE;

	hcan.Init.Prescaler = 7;
	hcan.Init.TimeSeg1 = CAN_BS1_9TQ;
	hcan.Init.TimeSeg2 = CAN_BS2_2TQ;

	hcan.Init.TimeTriggeredMode = DISABLE;
	hcan.Init.TransmitFifoPriority = ENABLE;

	if ( HAL_CAN_Init( &hcan ) != HAL_OK )
	{
		printf( "CAN_Init Err.\n" );
		while(1);
	}

	hfilter.FilterActivation = CAN_FILTER_ENABLE;
	hfilter.FilterBank = 0;
	hfilter.FilterFIFOAssignment = CAN_FILTER_FIFO0;

	/* Only STD message can be received. */
	hfilter.FilterIdHigh = 0;
	hfilter.FilterIdLow = 0;
	hfilter.FilterMaskIdHigh = 0;
	hfilter.FilterMaskIdLow = 0x0004;

	hfilter.FilterMode = CAN_FILTERMODE_IDMASK;
	hfilter.FilterScale = CAN_FILTERSCALE_32BIT;
	hfilter.SlaveStartFilterBank = 0;

	if ( HAL_CAN_ConfigFilter( &hcan, &hfilter ) != HAL_OK )
	{
		printf( "Filter config err.\n" );
		while(1);
	}

	if ( HAL_CAN_Start( &hcan ) != HAL_OK )
	{
		printf( "CAN start err.\n" );
		while(1);
	}

	HAL_NVIC_EnableIRQ( CAN1_RX0_IRQn );
	HAL_NVIC_SetPriority( CAN1_RX0_IRQn, 6, 0 );
	HAL_CAN_ActivateNotification( &hcan, CAN_IT_RX_FIFO0_MSG_PENDING );
}
```

这里都是常规配置，注意一下即可。本次移植我们配置为 CAN1 500kbps / 32位掩码模式，只收标准报文（CANopen只走标准报文收发）。

接下来实现协议的报文出口，也就是发送接口 `canSend()`。接口原型如下：

```c
/** 
 * @brief The CAN message structure 
 * @ingroup can
 */
typedef struct {
  UNS16 cob_id;	/**< message's ID */
  UNS8 rtr;		/**< remote transmission request. (0 if not rtr message, 1 if rtr message) */
  UNS8 len;		/**< message's length (0 to 8) */
  UNS8 data[8]; /**< message's datas */
} Message;

UNS8 canSend( CAN_PORT notused, Message *m );
```

可以看到，当协议内部需要向外发送一帧报文时，会调用该接口，并将 `m` 传入，该结构内部包含了已经由协议内部组装好了的通信报文(例如 PDO/SDO 等)，我们只需要使用 `m` 中所携带的参数，将报文发送到总线上即可。其参考实现如下：

```c
uint8_t 
canSend( CAN_PORT notused, Message *TxMessage )
{
	if ( !TxMessage )
		return 0;

	CAN_TxHeaderTypeDef txHeader;
	uint8_t i = 0;
	uint8_t txBuf[8];
	HAL_StatusTypeDef hReturn;
	uint32_t mailbox;

	txHeader.DLC = TxMessage->len;
	txHeader.RTR = TxMessage->rtr;
	txHeader.StdId = TxMessage->cob_id;	
	txHeader.IDE = CAN_ID_STD;		// 注意：txHeader此处必须显示赋值为 CAN_ID_STD.

	memcpy( txBuf, TxMessage->data, TxMessage->len );

	do 
	{
		hReturn = HAL_CAN_AddTxMessage( &hcan, &txHeader, txBuf, &mailbox );
		if ( hReturn != HAL_OK )
		{
			i++;
			DELAY(10);
		}
	} while( (hReturn != HAL_OK) && (i < 3) );

	return (i >= 3) ? 0 : 1; 
}
```

这里强调一下：txHeader 是被我们定义在局部栈空间中的，因此内部的值将是随机值（除非显示初始化为0），因此

`txHeader.IDE = CAN_ID_STD;`是必须的，不能够因为没用到就忽略！我在第一次移植时就没注意这个问题，导致波形抓出来全是拓展帧。



最后是中断处理，我们使用 CAN ISR，在 ISR 中收帧后直接喂给协议的状态机。

```c
void 
CAN1_RX0_IRQHandler( void )
{
	HAL_CAN_IRQHandler( &hcan );
}


void
HAL_CAN_RxFifo0MsgPendingCallback( CAN_HandleTypeDef *hcan )
{
	if ( hcan->Instance == CAN1 )
	{
		while( HAL_CAN_GetRxFifoFillLevel( hcan, CAN_RX_FIFO0 ) > 0 )
		{
			HAL_StatusTypeDef hReturn;
			CAN_RxHeaderTypeDef rxHeader;
			Message msg;
			uint8_t rxData[8];

            hReturn = HAL_CAN_GetRxMessage( hcan, CAN_RX_FIFO0, &rxHeader, rxData );
            if ( hReturn != HAL_OK )
				return;
			msg.cob_id = rxHeader.StdId;
			msg.len = rxHeader.DLC;
			msg.rtr = rxHeader.RTR;
			memcpy( msg.data, rxData, msg.len );

			canDispatch( &ObjDict_Data, &msg );   // 将收到的帧喂给协议栈内部.
		}
	}
}
```

将收到的报文信息（COB-ID，dataLen，data等）通过 `Message` 类型打包后，连同具体数据一并通过 `canDispatch()` 派发给协议栈内部，推动协议栈内部状态机的运行。至此，CAN 部分协议所需的我们已经填充完毕。

#### 定时器接口

我们使用基本定时器 TIM7 作为协议的时基来源，协议中要求时基配置为以 1 MHz 计数，也就是 1us。

```c
void 
HX_TIM_Init( void )
{
	__HAL_RCC_TIM7_CLK_ENABLE();

	htim7.Instance = TIM7;
	htim7.Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_DISABLE;
	htim7.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
	htim7.Init.CounterMode = TIM_COUNTERMODE_UP;
	htim7.Init.Period = 65535;  /* 占位，避免初始化后 1us 中断风暴 */
	htim7.Init.Prescaler = 84 - 1;
	htim7.Init.RepetitionCounter = 0;

	if ( HAL_TIM_Base_Init( &htim7 ) != HAL_OK )
	{
		printf( "TIM init fail\n" );
		while(1);
	}

	HAL_TIM_Base_Start_IT( &htim7 );
	HAL_NVIC_EnableIRQ( TIM7_IRQn );
	HAL_NVIC_SetPriority( TIM7_IRQn, 6, 0 );
}
```

这里我们 F4 主频配置到 168 Mhz，APB1 为 42 Mhz(4分频)，TIM7 时钟为 42*2 = 84Mhz。PSC = 83 → 计数频率 = 84MHz / 84 = 1MHz，即 1 个计数 = 1us，满足协议栈要求。这里有一个细节问题：由于上电后协议栈内部第一次调用 `setTimer()` 就会将 ARR 改动并且正式接管 ARR 寄存器。因此在配置 `Period` 时我们可以将其设置很大，防止在上电到第一次 `setTimer()` 被调用期间频繁触发中断影响性能。

接下来，我们需要维护一个全局计数值，用于记录上一次的定时器设定值，供协议栈内部对超时等事件进行判断：

```c
static TIMEVAL last_time_set = 0;
```

实现 `setTimer()` 用于协议内部重启定时，实现 `getElapsedTime( void )` 用于协议内部获取当前的系统绝对时间。其原型与参考实现分别如下：

```c
/**
 * @ingroup timer
 * @brief Set a timerfor a given time.
 * @param value The time value.
 */
void setTimer( TIMEVAL value );

/**
 * @ingroup timer
 * @brief Get the time elapsed since latest timer occurence.
 * @return time elapsed since latest timer occurence
 */
TIMEVAL getElapsedTime( void );
```

```c
static TIM_HandleTypeDef htim7;

TIMEVAL 
getElapsedTime( void )
{
    /* 距上次中断经过的微秒 */
	return htim7.Instance->CNT - last_time_set;
}

void 
setTimer( TIMEVAL value )
{
    /* value 微秒后触发 */
	htim7.Instance->ARR = htim7.Instance->CNT + value;
}
```



接下来还需要在定时中断中驱动内部状态机：

```c
void 
TIM7_IRQHandler( void )
{
	HAL_TIM_IRQHandler( &htim7 );
}

void 
HAL_TIM_PeriodElapsedCallback( TIM_HandleTypeDef *htim )
{
	if ( htim->Instance == TIM7 )
	{
		last_time_set = htim->Instance->CNT;  /* 更新时间 */
		TimeDispatch();		/* 驱动协议栈内部定时状态机. */
	}
}
```

这里要注意的是：基本定时器 ARR 是16位的，也就是说单次定时最大只能到 65535us (合 65.5ms)。而在我的移植中，协议配置的
最大延时时长就是16位的，因此不会存在问题。

```c
// The timer of the STM32 counts from 0000 to 0xFFFF
#define TIMEVAL_MAX 0xFFFF
```

若你的 `TIMEVAL_MAX` 超过了 16 位，则不能够使用基本定时器。应考虑 32 位变量软件计时，或使用通用定时器或高级定时器。



#### 对象字典

此处给出主机 / 从机的 OD 字典配置。

主机配置(master)：

```c
#include "user_master_objdict.h"

//////////////////////////////////////SDO配置(客户端)///////////////////////////////////////////
/* 子索引个数 */
UNS8 ObjDict_highestSubIndex_obj1280 = 3;
/* 客户端->服务器用的COB-ID */
UNS32 ObjDict_obj1280_COB_ID_Client_to_Server_Transmit_SDO = 0x600 + 1;	/* 1号节点 */
/* 服务器->客户端用的COB-ID */
UNS32 ObjDict_obj1280_COB_ID_Server_to_Client_Receive_SDO = 0x580 + 1;	/* 1号节点 */
/* 对应服务器的节点号 */
UNS8 ObjDict_obj1280_Node_ID_of_the_SDO_Server = 0x1;	/* 1号节点 */
subindex ObjDict_Index1280[] = 
{
	{RO, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1280},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1280_COB_ID_Client_to_Server_Transmit_SDO},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1280_COB_ID_Server_to_Client_Receive_SDO},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1280_Node_ID_of_the_SDO_Server}
};
///////////////////////////////////接收PDO通讯参数配置(客户端)////////////////////////////////////////////
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj1400 = 5;
/* 主站的接收PDO对应着从站的发送PDO，所以两边的COB-ID需要保持一致 */
UNS32 ObjDict_obj1400_COB_ID_used_by_PDO = 0x181;	/* PDO1 1号节点 */
/* PDO类型，0表示同步非周期，1-240表示同步周期，252表示同步RTR，253表示异步RTR，254表示异步制造商特定事件、255表示异步设备子协议特定事件，主站不需要配置 */
UNS8 ObjDict_obj1400_Transmission_Type = 0x0;
/* 禁止时间，主站不需要配置 */
UNS16 ObjDict_obj1400_Inhibit_Time = 0x0; /* 0 单位10us */
/* 保留不使用 */
UNS8 ObjDict_obj1400_Compatibility_Entry = 0x0;
/* 从站作为事件定时周期，主站作为事件超时时间，这里实验用同步周期所以不进行配置 */
UNS16 ObjDict_obj1400_Event_Timer = 0x0;
subindex ObjDict_Index1400[] = 
{
	{RO, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1400},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1400_COB_ID_used_by_PDO},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1400_Transmission_Type},
	{RW, uint16, sizeof(UNS16), (void *)&ObjDict_obj1400_Inhibit_Time},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1400_Compatibility_Entry},
	{RW, uint16, sizeof(UNS16), (void *)&ObjDict_obj1400_Event_Timer}
};
/////////////////////////////////接收PDO映射参数配置(客户端)//////////////////////////////////////////
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj1600 = 2;
/* bit0-7表示位数，bit8-15表示子索引，bit16-32表示索引 */
UNS32 ObjDict_obj1600[] = 
{
	0x20000108,	/* 索引为2000，子索引为1，位数为8位 */
	0x20000210,	/* 索引为2000，子索引为2，位数为16位 */
};
subindex ObjDict_Index1600[] = 
{
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1600},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1600[0]},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1600[1]},
};
////////////////////////被接收PDO映射的索引配置(客户端)////////////////////////////////////////
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj2000 = 2;
/* 用于存储接收到的数据 */
UNS8 ControlWordAxis1 = 0;
/* 用于存储接收到的数据 */
UNS16 ControlWordAxis2 = 0;
subindex ObjDict_Index2000[] =                                                    
{
	{RW, int8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj2000}, 
	{RW, uint8, sizeof(UNS8), (void *)&ControlWordAxis1},
	{RW, uint16, sizeof(UNS16), (void *)&ControlWordAxis2},
};
/* 第一个子索引接收到数据之后的回调函数 */
UNS32 ODCallback_t_Index2000_Subindex1(CO_Data *d, const indextable *index, UNS8 bSubindex)
{
	printf("ControlWordAxis1 = %d\r\n", ControlWordAxis1);
	return 0;
}
/* 第二个子索引接收到数据之后的回调函数 */
UNS32 ODCallback_t_Index2000_Subindex2(CO_Data *d, const indextable *index, UNS8 bSubindex)
{
	printf("ControlWordAxis2 = %d\r\n", ControlWordAxis2);
	return 0;
}
ODCallback_t ObjDict_Index2000_callbacks[] = 
{
	NULL,
	ODCallback_t_Index2000_Subindex1,
	ODCallback_t_Index2000_Subindex2,
};
/////////////////////////////////////////字典配置/////////////////////////////////////////////////////////
/* 字典的声明 */
const indextable ObjDict_objdict[] = 
{
	{NULL, 0, 0x0},
	{(subindex *)ObjDict_Index1280, sizeof(ObjDict_Index1280) / sizeof(ObjDict_Index1280[0]), 0x1280},
	{(subindex *)ObjDict_Index1400, sizeof(ObjDict_Index1400) / sizeof(ObjDict_Index1400[0]), 0x1400},
	{(subindex *)ObjDict_Index1600, sizeof(ObjDict_Index1600) / sizeof(ObjDict_Index1600[0]), 0x1600},
	{(subindex *)ObjDict_Index2000, sizeof(ObjDict_Index2000) / sizeof(ObjDict_Index2000[0]), 0x2000},
};

/* 通过索引查在字典中的下标 */
const indextable *ObjDict_scanIndexOD(UNS16 wIndex, UNS32 *errorCode, ODCallback_t **callbacks)
{
	int i;
	*callbacks = NULL;
	
	switch(wIndex)
	{
		case 0x1280: i = 1; break;
		case 0x1400: i = 2;	break;
		case 0x1600: i = 3;	break;
		case 0x2000: i = 4;	*callbacks = ObjDict_Index2000_callbacks; break;
		default:
			*errorCode = OD_NO_SUCH_OBJECT;
			return NULL;
	}
	*errorCode = OD_SUCCESSFUL;
	return &ObjDict_objdict[i];
}

/* 在字典中的下标 */
const quick_index ObjDict_firstIndex = {
	0,	/* 第一个SDO服务器，主站不需要配置服务器 */
	1,	/* 第一个SDO客户端，有多少个从站就需要配置多少个客户端 */
	2,	/* 第一个PDO接收端通讯参数，这里配置1个接收端(最多配置4个) */
	3,	/* 第一个PDO接收端映射参数，这里配置1个接收端 */
	0,	/* 第一个PDO发送端通讯参数，主站不需要配置发送端 */
	0		/* 第一个PDO发送端映射参数，主站不需要配置发送端 */
};

/* 在字典中的下标 */
const quick_index ObjDict_lastIndex = {
	0,	/* 最后一个SDO服务器，主站不需要配置服务器 */
	1,	/* 最后一个SDO客户端，有多少个从站就需要配置多少个客户端 */
	2,	/* 最后一个PDO接收端通讯参数，这里配置1个接收端(最多配置4个) */
	3,	/* 最后一个PDO接收端映射参数，这里配置1个接收端(最多配置4个) */
	0,	/* 最后一个PDO发送端通讯参数，主站不需要配置发送端 */
	0		/* 最后一个PDO发送端映射参数，主站不需要配置发送端 */
};

/* 字典的大小 */
const UNS16 ObjDict_ObjdictSize = sizeof(ObjDict_objdict)/sizeof(ObjDict_objdict[0]);

/* 对各数据类型的范围进行检查合法性检查 */
UNS32 ObjDict_valueRangeTest(UNS8 typeValue, void *value)
{
  switch(typeValue) 
	{
//    case int8:
//      if(*(INTEGER8 *)value != (INTEGER8)0)	//
//				return OD_VALUE_RANGE_EXCEEDED;
//      break;
			
		default:
			break;
  }	
	return 0;
}
///////////////////////////////////节点属性配置////////////////////////////////////////////////////////
/* ObjDict_iam_a_slave = 0表明该节点为主站 */
const UNS8 ObjDict_iam_a_slave = 0;
/* CanOpen规定主站节点号为0 */
UNS8 ObjDict_bDeviceNodeId = 0x00;
////////////////////////////////////心跳/节点保护报文配置//////////////////////////////////////////////
/* 心跳报文从站节点数，主站才需要配置，但是这里不使用心跳报文 */
UNS8 ObjDict_highestSubIndex_obj1016 = 0;
/* 心跳报文入口，其中存放了从站nod-id和倒计时时间，主站才需要配置，但是这里不使用心跳报文 */
UNS32 ObjDict_obj1016[1];
/* 心跳报文定时事件状态，主站才需要配置，但是这里不使用心跳报文 */
TIMER_HANDLE ObjDict_heartBeatTimers[1];
/* 从站上报心跳包间隔时间，从站才需要配置，但这里不使用心跳报文 */
UNS16 ObjDict_obj1017 = 0;
/* 节点保护报文，每60秒询问一次所有节点在线情况 */
UNS16 ObjDict_obj100C = 60000;
/* 节点保护报文，3次不回复则认为节点掉线 */	
UNS8 ObjDict_obj100D = 3;

//////////////////////////////////////同步报文配置///////////////////////////////////////////////////////
/* bit31表示是否开启同步报文，低16位表示cob-id，主站才需要配置 */
UNS32 ObjDict_obj1005 = 0x40000080;
/* 同步报文发送事件间隔为60秒 */
UNS32 ObjDict_obj1006 = 60000000;

/////////////////////////////////紧急报文配置///////////////////////////////////////////////////////
/* 紧急报文，用于存放错误，主站不要配置 */
UNS32 ObjDict_obj1003[EMCY_MAX_ERRORS];
/* 错误个数，主站不需要配置 */
UNS8 ObjDict_highestSubIndex_obj1003 = 0;
/* 用于存放错误标志位，主站不需要配置 */
UNS8 ObjDict_obj1001 = 0x0;
/* 紧急报文cob-id，主站不需要配置，从站在setNodeId函数中也会初始化，所以也不用配置 */
UNS32 ObjDict_obj1014 = 0x80;

/////////////////////////////////PDO报文配置////////////////////////////////////////////////////
/* 主站只要配置接收PDO，所以不需要设置PDO状态 */
s_PDO_status ObjDict_PDO_status[1];

///////////////////////////////////字典定义//////////////////////////////////////////////
/* CANOPEN字典 */
CO_Data ObjDict_Data = CANOPEN_NODE_DATA_INITIALIZER(ObjDict);

```

从机配置(slave)：

```c
#include "user_slave_objdict.h"

//////////////////////////////////////////////////SDO配置(服务器)/////////////////////////////////////
/* 子索引个数 */
UNS8 ObjDict_highestSubIndex_obj1200 = 3;
/* 客户端->服务器用的COB-ID */
UNS32 ObjDict_obj1200_COB_ID_Client_to_Server_Transmit_SDO = 0x600 + 1;	/* 1号节点 */
/* 服务器->客户端用的COB-ID */
UNS32 ObjDict_obj1200_COB_ID_Server_to_Client_Receive_SDO = 0x580 + 1;	/* 1号节点 */
/* 对应服务器的节点号 */
UNS8 ObjDict_obj1200_Node_ID_of_the_SDO_Server = 0x1;	/* 1号节点 */
subindex ObjDict_Index1200[] = 
{
	{RO, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1200},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1200_COB_ID_Client_to_Server_Transmit_SDO},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1200_COB_ID_Server_to_Client_Receive_SDO},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1200_Node_ID_of_the_SDO_Server}
};
////////////////////////////////////////////发送PDO通讯参数配置(客户端)//////////////////////////////////
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj1800 = 5;
/* 从站的发送PDO对应着主站的接收PDO，所以两边的COB-ID需要保持一致 */
UNS32 ObjDict_obj1800_COB_ID_used_by_PDO = 0x181;	/* PDO1 1号节点 */
/* PDO类型，0表示同步非周期，1-240表示同步周期，252表示同步RTR，253表示异步RTR，254表示异步制造商特定事件、255表示异步设备子协议特定事件，这里配置为同步一次 */
UNS8 ObjDict_obj1800_Transmission_Type = 0xFE;
/* 因为波特率为1MB/S，标准帧最长108位，所以禁止时间至少为108us，这里设置为1ms */
UNS16 ObjDict_obj1800_Inhibit_Time = 0x100; /* 0 单位10us */
/* 保留不使用 */
UNS8 ObjDict_obj1800_Compatibility_Entry = 0x0;
/* 从站作为事件定时周期，主站作为事件超时时间，这里实验用同步周期所以不进行配置 */
UNS16 ObjDict_obj1800_Event_Timer = 0x0;
subindex ObjDict_Index1800[] = 
{
	{RO, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1800},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1800_COB_ID_used_by_PDO},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1800_Transmission_Type},
	{RW, uint16, sizeof(UNS16), (void *)&ObjDict_obj1800_Inhibit_Time},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1800_Compatibility_Entry},
	{RW, uint16, sizeof(UNS16), (void *)&ObjDict_obj1800_Event_Timer}
};
ODCallback_t ObjDict_Index1800_callbacks[] = 
{
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
};

/* ========== TPDO2 通讯参数 (0x1801) ========== */
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj1801 = 5;
/* 从站的发送PDO对应着主站的接收PDO，所以两边的COB-ID需要保持一致 */
UNS32 ObjDict_obj1801_COB_ID_used_by_PDO = 0x281;	/* PDO1 1号节点 */
/* PDO类型，0表示同步非周期，1-240表示同步周期，252表示同步RTR，253表示异步RTR，254表示异步制造商特定事件、255表示异步设备子协议特定事件，这里配置为同步一次 */
UNS8 ObjDict_obj1801_Transmission_Type = 0xFE;
/* 因为波特率为1MB/S，标准帧最长108位，所以禁止时间至少为108us，这里设置为1ms */
UNS16 ObjDict_obj1801_Inhibit_Time = 0x100; /* 0 单位10us */
/* 保留不使用 */
UNS8 ObjDict_obj1801_Compatibility_Entry = 0x0;
/* 从站作为事件定时周期，主站作为事件超时时间，这里实验用同步周期所以不进行配置 */
UNS16 ObjDict_obj1801_Event_Timer = 0x0;
subindex ObjDict_Index1801[] = 
{
	{RO, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1801},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1801_COB_ID_used_by_PDO},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1801_Transmission_Type},
	{RW, uint16, sizeof(UNS16), (void *)&ObjDict_obj1801_Inhibit_Time},
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_obj1801_Compatibility_Entry},
	{RW, uint16, sizeof(UNS16), (void *)&ObjDict_obj1801_Event_Timer}
};
ODCallback_t ObjDict_Index1801_callbacks[] = 
{
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
};

////////////////////////////////////////////发送PDO映射参数配置(客户端)////////////////////////////////
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj1A00 = 2;
/* bit0-7表示位数，bit8-15表示子索引，bit16-32表示索引 */
UNS32 ObjDict_obj1A00[] = 
{
	0x20000108,	/* 索引为2000，子索引为1，位数为8位 */
	0x20000210,	/* 索引为2000，子索引为2，位数为16位 */
};
subindex ObjDict_Index1A00[] = 
{
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1A00},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1A00[0]},
	{RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1A00[1]},
};


/* ========== TPDO2 映射参数 (0x1A01) ========== */
UNS8 ObjDict_highestSubIndex_obj1A01 = 2;               /* 映射 2 个变量 */
UNS32 ObjDict_obj1A01[] = 
{
    0x20100110,  /* 映射 0x2010-1 (16位) */
    0x20100210   /* 映射 0x2010-2 (16位) */
};
subindex ObjDict_Index1A01[] = 
{
    {RW, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj1A01},
    {RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1A01[0]},
    {RW, uint32, sizeof(UNS32), (void *)&ObjDict_obj1A01[1]},
};

//////////////////////////////////////////被接收PDO映射的索引配置(客户端)///////////////////////////////////
/* 子索引数 */
UNS8 ObjDict_highestSubIndex_obj2000 = 2;
/* 用于存储将要发送的数据 */
UNS8 ControlWordAxis1 = 100;
/* 用于存储将要发送的数据 */
UNS16 ControlWordAxis2 = 1000;
subindex ObjDict_Index2000[] =                                                    
{
	{RW, int8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj2000}, 
	{RW, uint8, sizeof(UNS8), (void *)&ControlWordAxis1},
	{RW, uint16, sizeof(UNS16), (void *)&ControlWordAxis2},
};

UNS8 ObjDict_highestSubIndex_obj2010 = 2;
UNS16 test_half_word1 = 1250;
UNS16 test_half_word2 = 1600;
subindex ObjDict_Index2010[] = 
{
	{RW, uint8, sizeof(UNS8), (void *)&ObjDict_highestSubIndex_obj2010}, 
	{RW, uint16, sizeof(UNS16), (void *)&test_half_word1},
	{RW, uint16, sizeof(UNS16), (void *)&test_half_word2},
};
///////////////////////////////////////////////字典配置//////////////////////////////////////////////////////
/* 字典的声明 */
const indextable ObjDict_objdict[] = 
{
	{NULL, 0, 0x0},
	{(subindex *)ObjDict_Index1200, sizeof(ObjDict_Index1200) / sizeof(ObjDict_Index1200[0]), 0x1200},
	{(subindex *)ObjDict_Index1800, sizeof(ObjDict_Index1800) / sizeof(ObjDict_Index1800[0]), 0x1800},
	{(subindex *)ObjDict_Index1801, sizeof(ObjDict_Index1801) / sizeof(ObjDict_Index1801[0]), 0x1801},
	{(subindex *)ObjDict_Index1A00, sizeof(ObjDict_Index1A00) / sizeof(ObjDict_Index1A00[0]), 0x1A00},
	{(subindex *)ObjDict_Index1A01, sizeof(ObjDict_Index1A01) / sizeof(ObjDict_Index1A01[0]), 0x1A01},
	{(subindex *)ObjDict_Index2000, sizeof(ObjDict_Index2000) / sizeof(ObjDict_Index2000[0]), 0x2000},
	{(subindex *)ObjDict_Index2010, sizeof(ObjDict_Index2010) / sizeof(ObjDict_Index2010[0]), 0x2010},
};

/* 通过索引查在字典中的下标 */
const indextable *ObjDict_scanIndexOD(UNS16 wIndex, UNS32 *errorCode, ODCallback_t **callbacks)
{
	int i;
	*callbacks = NULL;
	
	switch(wIndex)
	{
		case 0x1200: i = 1; break;
		case 0x1800: i = 2;	*callbacks = ObjDict_Index1800_callbacks; break;
		case 0x1A00: i = 4;	break;
		case 0x1801: i = 3;	*callbacks = ObjDict_Index1801_callbacks; break;
		case 0x1A01: i = 5; break;
		case 0x2000: i = 6; break;
		case 0x2010: i = 7; break;
		default:
			*errorCode = OD_NO_SUCH_OBJECT;
			return NULL;
	}
	*errorCode = OD_SUCCESSFUL;
	return &ObjDict_objdict[i];
}

/* 在字典中的下标 */
const quick_index ObjDict_firstIndex = {
	1,	/* 第一个SDO服务器，每个从站配置一个服务器 */
	0,	/* 第一个SDO客户端，从站不需要配置客户端 */
	0,	/* 第一个PDO接收端通讯参数，从站不需要配置接收端 */
	0,	/* 第一个PDO接收端映射参数，从站不需要配置接收端 */
	2,	/* 第一个PDO发送端通讯参数，这里配置1个发送端(最多4个) */
	4		/* 第一个PDO发送端映射参数，这里配置1个发送端(最多4个) */
};

/* 在字典中的下标 */
const quick_index ObjDict_lastIndex = {
	1,	/* 最后一个SDO服务器，每个从站配置一个服务器 */
	0,	/* 最后一个SDO客户端，从站不需要配置客户端 */
	0,	/* 最后一个PDO接收端通讯参数，从站不需要配置接收端 */
	0,	/* 最后一个PDO接收端映射参数，从站不需要配置接收端 */
	3,	/* 最后一个PDO发送端通讯参数，这里配置1个发送端(最多4个) */
	5		/* 最后一个PDO发送端映射参数，这里配置1个发送端(最多4个) */
};

/* 字典的大小 */
const UNS16 ObjDict_ObjdictSize = sizeof(ObjDict_objdict)/sizeof(ObjDict_objdict[0]);

/* 对各数据类型的范围进行检查合法性检查 */
UNS32 ObjDict_valueRangeTest(UNS8 typeValue, void *value)
{
  switch(typeValue) 
	{
//    case int8:
//      if(*(INTEGER8 *)value != (INTEGER8)0)	//
//				return OD_VALUE_RANGE_EXCEEDED;
//      break;
			
		default:
			break;
  }	
	return 0;
}
/////////////////////////////////////////////节点属性配置//////////////////////////////////////////
/* ObjDict_iam_a_slave = 1表明该节点为从站 */
const UNS8 ObjDict_iam_a_slave = 1;
/* 设置该从站节点号为1 */
UNS8 ObjDict_bDeviceNodeId = 0x01;
/////////////////////////////////////////////心跳/节点保护报文配置/////////////////////////////////////////////
/* 心跳报文从站节点数，主站才需要配置，但是这里不使用心跳报文 */
UNS8 ObjDict_highestSubIndex_obj1016 = 0;
/* 心跳报文入口，其中存放了从站nod-id和倒计时时间，主站才需要配置，但是这里不使用心跳报文 */
UNS32 ObjDict_obj1016[1];
/* 心跳报文定时事件状态，主站才需要配置，但是这里不使用心跳报文 */
TIMER_HANDLE ObjDict_heartBeatTimers[1];
/* 从站上报心跳包间隔时间，从站才需要配置，但这里不使用心跳报文 */
UNS16 ObjDict_obj1017 = 0;
/* 节点保护报文，每60秒询问一次所有节点在线情况 */
UNS16 ObjDict_obj100C = 60;
/* 节点保护报文，3次不回复则认为节点掉线 */	
UNS8 ObjDict_obj100D = 3;

/////////////////////////////////////////////////同步报文配置/////////////////////////////////////////////////////
/* bit31表示是否开启同步报文，低16位表示cob-id，主站才需要配置 */
UNS32 ObjDict_obj1005 = 0;
/* 同步报文发送事件间隔时间，主站才需要配置 */
UNS32 ObjDict_obj1006 = 0;

/////////////////////////////////////////////////紧急报文配置/////////////////////////////////////////////////////
/* 紧急报文，用于存放错误信息 */
UNS32 ObjDict_obj1003[EMCY_MAX_ERRORS];
/* 错误个数 */
UNS8 ObjDict_highestSubIndex_obj1003 = 0;
/* 用于存放错误标志位，主站不需要配置 */
UNS8 ObjDict_obj1001 = 0x0;
/* 紧急报文cob-id，主站不需要配置，从站在setNodeId函数中也会初始化，所以也不用配置 */
UNS32 ObjDict_obj1014 = 0x80;

//////////////////////////////////////////////////PDO报文配置/////////////////////////////////////////////
/* 初始化PDO状态 */
s_PDO_status ObjDict_PDO_status[2] = {s_PDO_status_Initializer, s_PDO_status_Initializer};

/////////////////////////////////字典定义/////////////////////////////////////////////////////
/* CANOPEN字典 */
CO_Data ObjDict_Data = CANOPEN_NODE_DATA_INITIALIZER(ObjDict);

```



以上就是裸机移植 CAN Festival 的具体步骤，后续在主流程中，只需将两个 Init 初始化函数执行一遍将底层硬件正确配置，即可使用协议提供的 API 进行对应的控制。

移植过程中也要注意：整体 CAN 总线上的设备，波特率必须一致，同时根据使用需求，按需选择定时器的实现，注意定时器的位数。
