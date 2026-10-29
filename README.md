# 🔧 Swagger Helper

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white) ![Manifest](https://img.shields.io/badge/Manifest-V3-blue)

**Stop copy-pasting tokens into Swagger UI.** Swagger Helper is a Chrome extension that logs in for you, injects the token, switches environments and gives you copy-as-cURL on any endpoint. It is built for .NET and API developers who live in Swagger every day.

## ✨ Features

### 🔐 Auto login and token management
- **Auto login:** save credentials and authenticate against your API with one click
- **Role-based tokens:** store several tokens (admin, user, tester) and pick the active one from a dropdown
- **Token injection:** the active token is pushed into Swagger UI's Authorize dialog automatically
- **Flexible formats:** Bearer, API key or a custom prefix, with configurable login field names and request wrappers

### 🌍 Environment switching
- Local, Dev, Staging and Prod out of the box, plus unlimited custom environments
- Switch the Swagger base URL per environment without editing anything

### 🎨 Quality of life
- **Dark mode** for Swagger UI
- **Auto-collapse** all endpoints on page load
- **Copy as cURL** from any endpoint, with the current token included
- Keyboard shortcuts and debug tools for troubleshooting

## 📦 Installation

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the extension folder.

## 🌐 Where it runs

Swagger Helper **detects Swagger UI, ReDoc and RapiDoc automatically on any URL**, so there is nothing to configure for custom domains or paths. When a docs page is found, a floating bubble appears in the bottom-right corner.

How it works, and why the permission prompt says "all sites":

- A tiny detector script (`content/detector.js`) runs on every page. It only looks for Swagger UI / ReDoc / RapiDoc markers in the page structure. It does not read page text, cookies or storage, and it sends nothing anywhere.
- Only when a docs page is found does the background worker load the full helper into that tab. On every other site, nothing else runs and no bubble appears.
- Chrome shows "read and change all your data on all websites" because the detector must be able to check any page. If you prefer, you can restrict it in `manifest.json` by replacing `<all_urls>` in `content_scripts` and `host_permissions` with your own hosts.

## 🚀 Quick start

1. Open any Swagger UI page. The floating bubble appears automatically.
2. Click the bubble, or the Swagger Helper icon in the toolbar.
3. Choose an environment and enter its base URL.
4. Click **Login** (or add a token manually), then select the active token.
5. Use the Authorize dialog and try endpoints as normal.

## 🔒 Privacy and security

- Everything is stored locally in your browser with `chrome.storage`. Nothing is sent to any server owned by this project.
- Auto login sends your credentials only to the API URL you configure.
- Saved credentials and tokens are **not encrypted**. Use this with development and staging accounts, and do not save production passwords.
- The source is small and readable, so you can audit it yourself.

## 🤝 Contributing

Issues and pull requests are welcome. If you use a login format the extension does not handle yet, open an issue with a sample request and response (remove any real secrets).

## 📄 License

[MIT](LICENSE) © Faisal Shafi

---

Built by [Faisal Shafi](https://github.com/vtoxi). If this saves you time, you can [buy me a coffee](https://buymeacoffee.com/faisalshafi) ☕ or [get in touch](mailto:faisalshafi69@gmail.com?subject=Swagger%20Helper) about a project.
