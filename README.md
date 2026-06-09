# 🛡️ Gmail Link Guard

Gmail Link Guard is a security-focused Chrome Extension designed to protect users against phishing and email-based attacks by removing interactive links and showing the true URL destination. 

Instead of allowing direct clicks or hiding behind misleading anchor text, it forces transparency and safe practices directly in your Gmail interface.

---

## 🌟 Key Features

- **🚫 Click Protection & Link Defanging**: Converts all interactive anchor (`<a>`) links within emails into non-clickable plain-text `<span>` elements. This eliminates accidental clicks or hidden redirects.
- **🔍 Full URL Visibility**: Replaces the link text with the complete, raw destination URL so you can inspect it before deciding to visit.
- **⚠️ Suspicious URL Highlighting**: Automatically flags potential phishing indicators, including:
  - Numeric IP address domains (e.g., `http://192.168.1.1`).
  - Common URL shorteners (e.g., `bit.ly`, `tinyurl.com`, `t.co`).
  - IDN homograph attacks (e.g., `xn--` Punycode).
  - Cyrillic/non-Latin characters in domain names.
  - Typosquatted common domains (e.g., `g00gle.com`, `paypa1.com`).
- **🔗 Google Redirect Unwrapping**: Strips Google's tracking/redirect wrapper (`google.com/url?q=...`) to expose the absolute final destination.
- **📧 Inline Sender Details**: Appends the sender's actual email address directly beside their display name (e.g., `John Doe <john.doe@scamdomain.com>`) to help you immediately spot spoofed names.
- **⚡ Safe Compose & Reply**: Intelligently ignores editable compose fields, ensuring your email drafting workflow is never interrupted.
- **🔒 Privacy First**: Runs entirely locally in your browser. No external API calls are made, and no user data is collected or sent.

---

## 🚀 How to Install and Set Up

Since Gmail Link Guard is developed as an unpacked extension, follow these quick steps to load it into Google Chrome:

### Step 1: Get the Code
Clone this repository or download the source code files to your local machine:
```bash
git clone https://github.com/yourusername/gmail-link-guard.git
```
*(Or download the ZIP file and extract it to a directory of your choice).*

### Step 2: Open Chrome Extensions Manager
1. Launch Google Chrome.
2. In the URL bar, type **`chrome://extensions`** and press **Enter**.
3. Alternatively, click the Chrome menu (three dots) -> **Extensions** -> **Manage Extensions**.

### Step 3: Enable Developer Mode
In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 4: Load the Extension
1. Click the **Load unpacked** button in the top-left corner.
2. Select the `gmail-link-guard` directory (the folder containing `manifest.json`).

### Step 5: Verify & Pin
- You should now see **Gmail Link Guard** in your list of active extensions.
- Click the Extensions puzzle piece icon next to your profile picture in the Chrome toolbar and pin 🛡️ **Gmail Link Guard** for easy access.

---

## 🛠️ How It Works

1. **Manifest V3**: Complies with modern Chrome Extension standards using a lightweight and secure permissions model restricted to `https://mail.google.com/*`.
2. **SPA Navigation & Hash Monitoring**: Gmail is a Single Page Application (SPA) that doesn't trigger full page reloads. The extension monitors URL hash changes (via both `hashchange` events and a fast polling interval) to detect when you navigate into or out of an individual email view.
3. **Targeted Email Body Detection**: To conserve memory and CPU resources, the extension only initializes observers and replaces links when you are inside an individual email view. It waits for Gmail's email body containers (targeting selectors like `.a3s`, `.ii.gt`, or `[data-message-id]`) to render before processing.
4. **DOM Rewriting & Cleanups**: Replaces active `<a>` elements with custom styled `<span>` tags inside the message content. When you navigate away from an email view, it automatically disconnects observers and hides any active security panels.
5. **Secure Contextual Panel**: When clicked, a secure contextual dashboard pops up near your mouse cursor highlighting domain metrics and risk assessment so you can review and manually copy/paste the link safely.

---

## 📂 Project Structure

```bash
gmail-link-guard/
├── manifest.json   # Extension metadata and script declarations
├── content.js      # Main injection script doing the link replacement & security checks
├── styles.css      # Custom UI styles for inline warnings and security panel
├── popup.html      # Information popup available from Chrome's toolbar
└── icons/          # Extension icons in standard sizes (16x16, 48x48, 128x128)
```

---

## 🤝 Contributing

This extension is built entirely using standard HTML, CSS, and vanilla JavaScript (no bundlers or build steps required). 

1. Fork the repository.
2. Make your improvements in `content.js` or `styles.css`.
3. In `chrome://extensions`, click the **Reload** icon on Gmail Link Guard to test your changes instantly on Gmail.
4. Open a Pull Request!
