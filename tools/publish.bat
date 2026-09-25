@echo off
chcp 65001 >nul
title 照片墙发布服务（保持此窗口打开）
cd /d "%~dp0.."
echo.
echo  ============================================
echo   照片墙 · 本地发布服务
echo  ============================================
echo.
echo   保持此窗口打开，然后在浏览器里打开：
echo   http://localhost:50000/gallery/
echo.
echo   点「发布」→ 选图 + 写字 → 发布
echo   （自动压缩、加水印、更新页面、提交 git）
echo.
echo   关闭此窗口即停止服务。
echo  ============================================
echo.
node tools/publish-server.js
pause
