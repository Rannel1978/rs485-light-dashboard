# RS485 光照通信实验台 - 独立网页版本

本目录是一个完全独立的静态网站，只包含 HTML、CSS 和 JavaScript：

- 不调用 ChatGPT 或 OpenAI。
- 不需要服务器后端、数据库或 npm。
- 不会把开发板串口数据上传到服务器。
- 串口数据只在当前电脑的浏览器中读取和显示。
- 发布到 GitHub Pages 后，任何拿到网址的人都能直接打开。

## 发布后的使用条件

1. 使用 Windows、macOS 或 Linux 的桌面版 Chrome/Edge。
2. 网页必须通过 HTTPS 打开；GitHub Pages 默认提供 HTTPS。
3. 开发板通过 USB_232 接口连接电脑。
4. 点击“连接发射端”和“连接接收端”，并在浏览器弹窗中选择对应 COM 口。
5. 串口固定为 115200、8 数据位、1 停止位、无校验、无流控。
6. 串口助手和网页不能同时占用同一个 COM 口。

## GitHub Pages 发布方法

1. 在 GitHub 新建一个公开仓库，例如 `rs485-light-dashboard`。
2. 把本目录内的全部文件上传到仓库根目录，不能只上传 `index.html`。
3. 打开仓库的 `Settings` -> `Pages`。
4. 在 `Build and deployment` 中选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/ (root)`，点击 `Save`。
6. 等待 GitHub Pages 完成发布。
7. 公开网址通常为：

   `https://你的GitHub用户名.github.io/rs485-light-dashboard/`

## 文件说明

- `index.html`：网页结构。
- `styles.css`：页面样式。
- `app.js`：Web Serial 串口连接、数据解析、曲线、日志和 CSV 导出。
- `.nojekyll`：让 GitHub Pages 按普通静态文件发布。

## 验证方法

没有开发板时，可以点击“启动演示”检查页面显示。连接实物前，应先关闭演示模式和串口助手，再选择开发板对应的 COM 口。
