/**
 * 使用 backend/resources 下的「加密.js」与「登录.js」中的 RSA 参数加密明文密码。
 * 用法: node backend/resources/encrypt_password.cjs <明文密码>
 * 输出: 十六进制密文（与浏览器 encryptedString 一致，去掉空格）。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const plain = process.argv[2];
if (!plain) {
  console.error("usage: node encrypt_password.cjs <password>");
  process.exit(2);
}

const resourceRoot = __dirname;
const encryptPath = path.join(resourceRoot, "加密.js");
const loginPath = path.join(resourceRoot, "登录.js");

if (!fs.existsSync(encryptPath)) {
  console.error("missing:", encryptPath);
  process.exit(1);
}
if (!fs.existsSync(loginPath)) {
  console.error("missing:", loginPath);
  process.exit(1);
}

const loginSrc = fs.readFileSync(loginPath, "utf8");
const m = loginSrc.match(/getKeyPair\("010001",\s*'',\s*"([^"]+)"\)/);
if (!m) {
  console.error('could not find modulus in 登录.js (getKeyPair("010001", "", "..."))');
  process.exit(1);
}
const modulus = m[1];

const ctx = { window: {} };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(encryptPath, "utf8"), ctx);

const RSAUtils = ctx.window.RSAUtils;
if (!RSAUtils) {
  console.error("RSAUtils not defined after loading 加密.js");
  process.exit(1);
}

RSAUtils.setMaxDigits(131);
const key = RSAUtils.getKeyPair("010001", "", modulus);
const result = String(RSAUtils.encryptedString(key, plain)).replace(/\s+/g, "");
process.stdout.write(result);
