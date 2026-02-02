# ChatBinder - AI chat organizer

A local web application for viewing, organizing, and managing your LLM conversation history. Works entirely in your browser - no data leaves your device.

This is an active project. Iterating fast currently but welcome testing! 

Current version support ChatGPT，Claude and DeepSeek conversations, as well as reading the parser's own file.

## ✨ Features

### 📁 Smart Organization
- **Folder-based sidebar** with collapsible sections
- **Starred Conversations** - Mark entire conversations as favorites
- **Starred Pairs** - Bookmark specific Q&A exchanges
- **All Conversations** - Always visible, never lose your data

### 🔍 Search & Sort
- **Global search** across all conversations
- **Sort options:**
  - Newest (Created) - Sort by when the conversation started
  - Oldest (Created) - Reverse chronological order
  - Recently Updated - Sort by latest activity
  - Alphabetical (A-Z) - Sort by title

### 💾 Data Management
- **Import** ChatGPT, Claude, and DeepSeek exports (JSON and HTML formats)
- **IndexedDB storage** - Handle large datasets efficiently
- **Export** your parsed data as JSON
- **Persistent storage** - Data stays in your browser

## ✨ Future features: to dos ✨

- **Metadata format optimizing <- next**
- **Settings, localization and documentation in page**
- **Custom range export**
- **More LLM conversation support**
- **Better sort (By model type etc.)**
- **LLM assisted search and analysis (including local LLM support)**
- **Memory summarizing (for model transfering)**


## 🚀 Getting Started

### 1. Export Your Conversations

**From ChatGPT:**
1. Go to [chatgpt.com](https://chatgpt.com)
2. Click on your profile (botton-left)
3. Go to **Settings** → **Data Controls** → **Export data**
4. Request export and wait for the email
5. Download the ZIP file and extract `conversations.json` or `chat.html`

**From Claude:**
1. Go to [claude.com](https://claude.com)
2. Click on your profile (botton-left)
3. Go to **Settings** → **Privacy** → **Export data**
4. Request export and wait for the email (you can choose time range of your history)
5. Download the JSON file `conversations.json` 

**From Gemini (partial support):**
1. Go to [google takeout]([https://takeout.google.com/])
2. Select "my activity" and deselect all of others (Gemini Gem not support yet)
3. In **My Activity options** -> **Activity format**, choose JSON
4. In "My Activity content options", deselect all and keep Gemini
5. Download the JSON file

**From DeepSeek:**
1. Go to [chat.deepseek.com](https://chat.deepseek.com)
2. Click on your profile (botton-left)
3. Go to **Settings** → **Data** →**Export Data** 
4. Download the ZIP file and extract `conversations.json`

### 2. Import to the Parser

1. Open this application in your browser
2. Click **"Import Chat History"** or drag & drop your exported file
3. Your conversations will appear in the sidebar instantly

### 3. Organize & Browse

- **Browse** all conversations in the "All Conversations" folder
- **Star** important conversations by clicking the ⭐ icon
- **Star** specific answers by clicking the ☆ Star button below any response
- **Search** for specific topics using the search bar
- **Sort** conversations using the dropdown menu

## 📋 Features in Detail

### Starred Pairs 💎

Star individual Q&A pairs that contain valuable information:

1. Open any conversation
2. Find the answer you want to save
3. Click the **☆ Star** button below the response
4. Access it later from the **"💎 Starred Pairs"** folder
5. Click any starred pair to jump directly to it with a gold highlight

### Folder System

- **⭐ Starred Conversations** - Conversations you've marked as favorites
- **💎 Starred Pairs** - Individual Q&A exchanges you've bookmarked
- **All Conversations** - Your complete conversation history (always expanded)

### Timestamp Tracking

The parser maintains two timestamps for each conversation:

- **Created** - When the conversation first started
- **Updated** - When the last message was sent

This ensures accurate sorting even if you delete some message pairs.

## 🔒 Privacy & Security

- **100% Local** - All data stored in your browser's IndexedDB
- **No servers** - No data transmission to external services
- **No tracking** - No analytics or monitoring
- **No accounts** - Works completely offline after first load

## 🛠️ Technical Details

### Supported Formats

- **ChatGPT** (JSON & HTML exports)
  - Native export format from ChatGPT data export
  - HTML conversation files
- **Claude** (JSON exports)
  - Native export format from Claude
  - Automatically hides tool_use blocks
- **DeepSeek** (JSON exports)
  - DeepSeek Chat and DeepSeek Reasoner
  - Collapsible thinking/reasoning sections
- **Auto-detection** - Automatically identifies format type

### Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (not supported)

### Storage

- Uses **IndexedDB** for large datasets (thousands of conversations)
- **localStorage** fallback for smaller datasets
- No limit on number of conversations
- Typical limit: Several hundred MB depending on browser

## 📝 Tips & Tricks

1. **Use descriptive titles** - Edit conversation titles to easily find them later
2. **Star selectively** - Only star the most important pairs to keep them manageable
3. **Search first** - Use search before browsing to find specific topics quickly
4. **Regular exports** - Periodically export your data as backup
5. **Clear old data** - Use "Clear Data" to start fresh when needed

## 🔄 Version History

### Current Version
- Folder-based sidebar organization
- Dual timestamp tracking (created/updated)
- Starred pairs with gold border highlighting
- Enhanced sorting options
- Improved text readability
- White text for better contrast

## 📄 License

This project is open source and available for personal and educational use.

## 🤝 Contributing

This is a personal project for managing LLM conversations. Feel free to fork and customize for your needs!

---

**Made by LuxPrizma for better AI chat management**
