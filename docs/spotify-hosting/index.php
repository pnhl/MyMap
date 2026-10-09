<?php
// Install as the callback handler at https://mymap.html-5.me/?i=1 .
// OAuth tokens and PKCE verifier stay in MyMap; no client secret is used here.
header('Cache-Control: no-store, max-age=0');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trở về MyMap</title>
<style>body{margin:0;background:#101827;color:#fff;font:16px/1.6 system-ui;display:grid;place-items:center;min-height:100svh}main{max-width:420px;padding:28px}h1{font-size:26px}a{display:inline-block;padding:12px 22px;border-radius:24px;background:#4464f6;color:white;text-decoration:none}p{color:#b9c7dc}</style>
<main><h1>Trở về MyMap</h1><p id="status">Mở MyMap để hoàn tất liên kết tài khoản Spotify của bạn.</p><a id="return" hidden>Tiếp tục trong MyMap</a></main>
<script>
const params=new URLSearchParams(location.search);
const state=params.get('state');const code=params.get('code');const error=params.get('error');
const validState=state&&/^[a-f0-9]{48}$/.test(state);
if(validState&&((code&&code.length<4096)||error)){
 const query=new URLSearchParams({state});
 if(code)query.set('code',code);else query.set('error',error.slice(0,128));
 const target='mymap://spotify?'+query;
 const link=document.getElementById('return');link.href=target;link.hidden=false;
 document.getElementById('status').textContent=error?'Bạn đã hủy liên kết. Trở về MyMap để tiếp tục.':'Đăng nhập đã xong. Chạm bên dưới nếu MyMap chưa tự mở.';
 location.replace(target);
}else document.getElementById('status').textContent='Đây là trang callback của MyMap. Hãy bắt đầu liên kết Spotify từ mục Âm nhạc trong ứng dụng.';
</script></html>
