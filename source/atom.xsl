<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:atom="http://www.w3.org/2005/Atom">

  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>RSS 订阅 - <xsl:value-of select="atom:feed/atom:title"/></title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
            background: #fdf0f6;
            color: #2f3542;
            line-height: 1.8;
            padding: 40px 20px;
          }
          .wrap { max-width: 720px; margin: 0 auto; }
          .card {
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(224, 86, 138, 0.10);
            padding: 32px 36px;
            margin-bottom: 24px;
          }
          h1 { font-size: 24px; margin-bottom: 6px; color: #d94a86; }
          .sub { color: #888; font-size: 14px; margin-bottom: 20px; }
          .tip {
            background: rgba(255, 154, 203, 0.10);
            border-left: 4px solid #ff9acb;
            border-radius: 0 8px 8px 0;
            padding: 14px 18px;
            margin: 16px 0;
            font-size: 15px;
          }
          .url {
            display: inline-block;
            background: #fdf0f6;
            border: 1px dashed #ff9acb;
            border-radius: 6px;
            padding: 6px 12px;
            font-family: Consolas, monospace;
            font-size: 13px;
            color: #c0396e;
            word-break: break-all;
            margin-top: 8px;
          }
          h2 { font-size: 17px; color: #d94a86; margin-bottom: 14px; }
          .item {
            padding: 12px 0;
            border-bottom: 1px solid #fce4ef;
            display: flex;
            align-items: baseline;
            gap: 12px;
          }
          .item:last-child { border-bottom: none; }
          .date { color: #b0a0aa; font-size: 13px; white-space: nowrap; font-family: Consolas, monospace; }
          .item a { color: #e0568a; text-decoration: none; }
          .item a:hover { text-decoration: underline; }
          .foot { text-align: center; color: #b0a0aa; font-size: 13px; margin-top: 8px; }
          .foot a { color: #e0568a; text-decoration: none; }
          .flower { font-size: 20px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1><span class="flower">🌸</span> RSS 订阅源</h1>
            <div class="sub">
              <xsl:value-of select="atom:feed/atom:title"/>
              <xsl:text> · 共 </xsl:text>
              <xsl:value-of select="count(atom:feed/atom:entry)"/>
              <xsl:text> 篇最新文章</xsl:text>
            </div>
            <div class="tip">
              <strong>这是一个 RSS 订阅源</strong>，不是普通网页。<br/>
              复制下面的地址，粘贴到你的 RSS 阅读器（Feedly / Inoreader / NetNewsWire 等）中订阅，就能第一时间收到更新：
              <br/>
              <span class="url"><xsl:value-of select="atom:feed/atom:link[@rel='self']/@href"/></span>
            </div>
          </div>
          <div class="card">
            <h2>最新文章</h2>
            <xsl:for-each select="atom:feed/atom:entry">
              <div class="item">
                <span class="date"><xsl:value-of select="substring(atom:updated, 1, 10)"/></span>
                <a href="{atom:link/@href}" target="_blank">
                  <xsl:value-of select="atom:title"/>
                </a>
              </div>
            </xsl:for-each>
          </div>
          <div class="foot">
            <a href="/">← 返回 <xsl:value-of select="atom:feed/atom:title"/></a>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
