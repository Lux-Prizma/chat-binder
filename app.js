// Main Application Controller

class ChatGPTParserApp {
    constructor() {
        this.data = chatData;
        this.currentView = 'upload'; // 'upload' or 'chat'
        this.searchResults = [];
        this.currentSort = 'newestCreated'; // Default sort option
        this.highlightedPairId = null; // For starred pair highlighting
        this.init();
    }

    init() {
        this.bindEvents();
        // Make init async to handle IndexedDB loading
        this.initAsync();
    }

    async initAsync() {
        await this.loadFromStorage();
        this.updateUI();
    }

    bindEvents() {
        // File upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        document.getElementById('newChatBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // Sort control
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.updateConversationList();
        });

        // Filter button (placeholder for now)
        document.getElementById('filterBtn').addEventListener('click', () => {
            // TODO: Implement date filter dialog
            alert('Date filter coming soon!');
        });

        // Folder headers - collapsible folders
        document.querySelectorAll('.folder-header[data-folder]').forEach(header => {
            header.addEventListener('click', (e) => {
                const folderId = header.dataset.folder;
                this.toggleFolder(folderId);
            });
        });

        // Global search
        document.getElementById('globalSearchInput').addEventListener('input', (e) => {
            this.handleGlobalSearch(e.target.value);
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Edit thread title
        document.getElementById('editTitleBtn').addEventListener('click', () => {
            this.toggleTitleEdit();
        });

        document.getElementById('threadTitleInput').addEventListener('blur', () => {
            this.saveTitleEdit();
        });

        document.getElementById('threadTitleInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTitleEdit();
            }
        });

        // Delete thread
        document.getElementById('deleteThreadBtn').addEventListener('click', () => {
            this.deleteCurrentThread();
        });

        // Thread search
        document.getElementById('threadSearchInput').addEventListener('input', (e) => {
            this.handleThreadSearch(e.target.value);
        });

        // Save project
        document.getElementById('saveProjectBtn').addEventListener('click', () => {
            this.saveProject();
        });

        // Clear data
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                this.clearAllData();
            }
        });
    }

    toggleFolder(folderId) {
        const folder = document.querySelector(`.folder-header[data-folder="${folderId}"]`);
        const content = document.getElementById(`${folderId}Content`);
        const arrow = folder.querySelector('.folder-arrow');

        if (!folder || !content || !arrow) {
            console.error('Folder elements not found:', { folderId, folder, content, arrow });
            return;
        }

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            arrow.classList.remove('collapsed');
        } else {
            content.classList.add('collapsed');
            arrow.classList.add('collapsed');
        }
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const totalConversations = [];
        let processed = 0;

        for (const file of files) {
            try {
                const content = await file.text();
                let conversations = [];

                if (file.name.endsWith('.json')) {
                    const jsonData = JSON.parse(content);
                    conversations = this.data.parseJSONExport(jsonData);
                } else if (file.name.endsWith('.html')) {
                    conversations = this.data.parseHTMLExport(content);
                }

                totalConversations.push(...conversations);
                processed++;
            } catch (error) {
                console.error('Error parsing file', file.name, ':', error);
                alert(`Error parsing file: ${file.name}\n\n${error.message}`);
            }
        }

        if (totalConversations.length > 0) {
            await this.data.addConversations(totalConversations);
            alert(`Successfully imported ${totalConversations.length} conversation(s)!`);
            this.updateUI();
        } else {
            alert('No valid conversations found in the uploaded file(s).');
        }

        // Reset file input
        document.getElementById('fileInput').value = '';
    }

    async loadFromStorage() {
        await this.data.loadFromStorage();
        // Load saved sort preference if exists
        this.currentSort = this.data.currentSort || 'newestCreated';
        document.getElementById('sortSelect').value = this.currentSort;
    }

    updateUI() {
        this.updateConversationList();
        this.updateMainView();
    }

    sortConversations(conversations) {
        const sorted = [...conversations];

        switch (this.currentSort) {
            case 'newestCreated':
                sorted.sort((a, b) => b.createTime - a.createTime);
                break;
            case 'oldestCreated':
                sorted.sort((a, b) => a.createTime - b.createTime);
                break;
            case 'recentlyUpdated':
                sorted.sort((a, b) => b.updateTime - a.updateTime);
                break;
            case 'alphabetical':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }

        return sorted;
    }

    updateConversationList() {
        // Get all conversations
        let allConversations = this.data.conversations;

        // Get starred conversations
        const starredConversations = allConversations.filter(conv => conv.starred);

        // Get starred pairs
        const allStarredPairs = this.data.getStarredPairs();

        // Apply search filter if active
        const searchQuery = document.getElementById('globalSearchInput').value.trim();

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            allConversations = allConversations.filter(conv => {
                // Search in title
                if (conv.title.toLowerCase().includes(lowerQuery)) {
                    return true;
                }
                // Search in pairs
                return conv.pairs.some(pair =>
                    pair.question.content.toLowerCase().includes(lowerQuery) ||
                    pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery))
                );
            });
        }

        // Sort conversations
        const sortedAll = this.sortConversations(allConversations);
        const sortedStarred = this.sortConversations(starredConversations);

        // Update folder counts
        document.querySelector('#allConversationsFolder .folder-count').textContent = `(${sortedAll.length})`;
        document.querySelector('#starredConversationsFolder .folder-count').textContent = `(${sortedStarred.length})`;
        document.querySelector('#starredPairsFolder .folder-count').textContent = `(${allStarredPairs.length})`;

        // Render All Conversations folder
        this.renderConversationFolder(
            document.getElementById('allConversationsContent'),
            sortedAll,
            searchQuery
        );

        // Render Starred Conversations folder
        this.renderConversationFolder(
            document.getElementById('starredConversationsContent'),
            sortedStarred,
            searchQuery
        );

        // Render Starred Pairs folder
        this.renderStarredPairsFolder(
            document.getElementById('starredPairsContent'),
            allStarredPairs,
            searchQuery
        );
    }

    renderConversationFolder(container, conversations, searchQuery) {
        container.innerHTML = '';

        if (conversations.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';

            if (searchQuery) {
                emptyState.innerHTML = `
                    <p>No results found</p>
                    <small>Try a different search term</small>
                `;
            } else {
                emptyState.innerHTML = `
                    <p>No conversations</p>
                    <small>Import your ChatGPT export to get started</small>
                `;
            }

            container.appendChild(emptyState);
            return;
        }

        // Render conversation items
        conversations.forEach(conv => {
            const item = this.createConversationItem(conv);
            container.appendChild(item);
        });
    }

    createConversationItem(conv) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.id = conv.id;

        if (this.data.currentConversationId === conv.id) {
            item.classList.add('active');
        }

        const date = new Date(conv.updateTime * 1000);
        const dateStr = this.formatDate(date);

        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <div class="conversation-item-title" title="${this.escapeHtml(conv.title)}">
                ${this.escapeHtml(conv.title)}
            </div>
            <span class="star-icon ${conv.starred ? 'starred' : ''}" data-id="${conv.id}">
                ${conv.starred ? '⭐' : '☆'}
            </span>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('star-icon')) {
                this.selectConversation(conv.id);
            }
        });

        const starIcon = item.querySelector('.star-icon');
        starIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStarConversation(conv.id);
        });

        return item;
    }

    renderStarredPairsFolder(container, starredPairs, searchQuery) {
        container.innerHTML = '';

        // Apply search filter if active
        let filteredPairs = starredPairs;
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            filteredPairs = starredPairs.filter(pair =>
                pair.question.content.toLowerCase().includes(lowerQuery) ||
                pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery))
            );
        }

        if (filteredPairs.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';

            if (searchQuery) {
                emptyState.innerHTML = `
                    <p>No starred pairs match your search</p>
                    <small>Try a different search term</small>
                `;
            } else {
                emptyState.innerHTML = `
                    <p>No starred pairs yet</p>
                    <small>Star pairs to see them here</small>
                `;
            }

            container.appendChild(emptyState);
            return;
        }

        // Render starred pair items
        filteredPairs.forEach((pair) => {
            const item = this.createStarredPairItem(pair);
            container.appendChild(item);
        });
    }

    createStarredPairItem(pair) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.pairId = pair.id;
        item.dataset.conversationId = pair.conversationId;

        // Get preview text from question
        const previewText = pair.question.content.substring(0, 50);
        const truncatedText = previewText.length < pair.question.content.length
            ? previewText + '...'
            : previewText;

        item.innerHTML = `
            <span class="star-icon starred">💎</span>
            <div class="conversation-item-title" title="${this.escapeHtml(pair.question.content)}">
                ${this.escapeHtml(truncatedText)}
            </div>
            <small style="color: var(--text-muted);">from "${this.escapeHtml(pair.conversationTitle)}"</small>
        `;

        item.addEventListener('click', () => {
            this.selectConversationWithHighlightedPair(pair.conversationId, pair.id);
        });

        return item;
    }

    selectConversationWithHighlightedPair(conversationId, pairId) {
        this.data.currentConversationId = conversationId;
        this.highlightedPairId = pairId;
        this.updateUI();

        // Clear thread search
        document.getElementById('threadSearchInput').value = '';

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    updateMainView() {
        const uploadState = document.getElementById('uploadState');
        const chatView = document.getElementById('chatView');

        if (!this.data.currentConversationId) {
            uploadState.style.display = 'flex';
            chatView.style.display = 'none';
            this.currentView = 'upload';
            return;
        }

        uploadState.style.display = 'none';
        chatView.style.display = 'flex';
        this.currentView = 'chat';

        const conv = this.data.getCurrentConversation();
        if (conv) {
            document.getElementById('threadTitleInput').value = conv.title;
            this.renderPairs(conv.pairs);

            // Scroll to highlighted pair if set
            if (this.highlightedPairId) {
                // Use a longer timeout and multiple attempts to find the element
                const scrollToPair = (attempt = 0) => {
                    const highlightedPair = document.querySelector(`.pair-container[data-pair-id="${this.highlightedPairId}"]`);
                    if (highlightedPair) {
                        highlightedPair.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        this.highlightedPairId = null; // Clear after scrolling
                    } else if (attempt < 10) {
                        // Try again with a longer delay
                        setTimeout(() => scrollToPair(attempt + 1), 100);
                    } else {
                        this.highlightedPairId = null;
                    }
                };
                setTimeout(() => scrollToPair(), 200);
            }
        }
    }

    renderPairs(pairs, filterQuery = '') {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        let filteredPairs = pairs;

        if (filterQuery) {
            const lowerQuery = filterQuery.toLowerCase();
            filteredPairs = pairs.filter(pair =>
                pair.question.content.toLowerCase().includes(lowerQuery) ||
                pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery))
            );
        }

        if (filteredPairs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <p>${filterQuery ? 'No messages match your search' : 'No messages in this conversation'}</p>
                </div>
            `;
            return;
        }

        filteredPairs.forEach(pair => {
            const pairEl = this.createPairElement(pair);
            container.appendChild(pairEl);
        });
    }

    createPairElement(pair) {
        const container = document.createElement('div');
        container.className = 'pair-container';
        container.dataset.pairId = pair.id;

        // Add highlight class if this is the highlighted starred pair
        if (this.highlightedPairId === pair.id) {
            container.classList.add('highlighted-starred');
        }

        // Create question element (user message with index)
        const questionEl = this.createQuestionElement(pair.question, pair.index);
        container.appendChild(questionEl);

        // Create answer element(s) - only put actions on the last answer
        if (pair.answers.length === 0) {
            // No response from assistant
            const noResponseEl = document.createElement('div');
            noResponseEl.className = 'message assistant';
            noResponseEl.innerHTML = `
                <div class="message-content">
                    <div class="message-body">
                        <div class="message-text"><em>No response</em></div>
                    </div>
                </div>
            `;
            container.appendChild(noResponseEl);
        } else {
            pair.answers.forEach((answer, index) => {
                const isLastAnswer = index === pair.answers.length - 1;
                const answerEl = this.createAnswerElement(answer, pair.id, pair.starred, isLastAnswer);
                container.appendChild(answerEl);
            });
        }

        return container;
    }

    createQuestionElement(question, index) {
        const div = document.createElement('div');
        div.className = 'message user';

        div.innerHTML = `
            <div class="message-content">
                <div class="message-index">${index}</div>
                <div class="message-body">
                    <div class="message-text">${this.formatMessageContent(question.content)}</div>
                </div>
            </div>
        `;

        return div;
    }

    createAnswerElement(answer, pairId, isStarred, showActions) {
        const container = document.createElement('div');
        container.className = 'message assistant';

        const timestamp = new Date(answer.timestamp * 1000);
        const timestampStr = this.formatDateTime(timestamp);

        // Get model name
        const model = answer.model || 'AI';

        // Build thinking section HTML if present
        let thinkingHtml = '';
        if (answer.thinking) {
            thinkingHtml = `
                <div class="thinking-section">
                    <button class="thinking-toggle" onclick="this.parentElement.classList.toggle('collapsed')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <span>Thinking Process</span>
                    </button>
                    <div class="thinking-content">
                        <div class="message-text">${this.formatMessageContent(answer.thinking)}</div>
                    </div>
                </div>
            `;
        }

        // Build artifact sections HTML if present
        let artifactsHtml = '';
        if (answer.artifacts && answer.artifacts.length > 0) {
            answer.artifacts.forEach((artifact, index) => {
                const formattedContent = this.formatArtifactContent(artifact.type, artifact.content);
                artifactsHtml += `
                    <div class="thinking-section">
                        <button class="thinking-toggle" onclick="this.parentElement.classList.toggle('collapsed')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                            <span>📦 Artifact: ${this.escapeHtml(artifact.title)}</span>
                        </button>
                        <div class="thinking-content">
                            ${formattedContent}
                        </div>
                    </div>
                `;
            });
        }

        const actionsHtml = showActions ? `
            <div class="message-actions">
                <span class="model-badge">${model}</span>
                <button class="message-action-btn timestamp" title="Show timestamp">
                    🕒 ${timestampStr}
                </button>
                <button class="message-action-btn star ${isStarred ? 'starred' : ''}" data-pair-id="${pairId}">
                    ${isStarred ? '⭐ Starred' : '☆ Star'}
                </button>
                <button class="message-action-btn delete" data-pair-id="${pairId}">
                    🗑️ Delete
                </button>
            </div>
        ` : '';

        container.innerHTML = `
            <div class="message-content">
                <div class="message-body">
                    ${thinkingHtml}
                    ${artifactsHtml}
                    <div class="message-text">${this.formatMessageContent(answer.content)}</div>
                    ${actionsHtml}
                </div>
            </div>
        `;

        // Add event listeners for actions
        if (showActions) {
            const deleteBtn = container.querySelector('.delete');
            deleteBtn.addEventListener('click', () => {
                this.deletePair(pairId);
            });

            const starBtn = container.querySelector('.star');
            starBtn.addEventListener('click', () => {
                this.toggleStarPair(pairId);
            });

            // Add toggle listener for thinking section
            const thinkingToggle = container.querySelector('.thinking-toggle');
            if (thinkingToggle) {
                thinkingToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }

        return container;
    }

    formatArtifactContent(type, content) {
        // Escape HTML to prevent rendering
        const escapedContent = this.escapeHtml(content);

        // Determine language for syntax highlighting based on type
        let language = 'text';
        if (type.includes('html')) {
            language = 'html';
        } else if (type.includes('json')) {
            language = 'json';
        } else if (type.includes('javascript') || type.includes('js')) {
            language = 'javascript';
        } else if (type.includes('python') || type.includes('py')) {
            language = 'python';
        } else if (type.includes('css')) {
            language = 'css';
        } else if (type.includes('markdown') || type.includes('md')) {
            language = 'markdown';
        }

        // Format as code block with syntax highlighting class
        return `
            <pre class="message-text"><code class="language-${language}">${escapedContent}</code></pre>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async selectConversation(id) {
        this.data.currentConversationId = id;
        await this.data.saveToStorage();
        this.updateUI();

        // Clear thread search
        document.getElementById('threadSearchInput').value = '';

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    handleGlobalSearch(query) {
        this.updateConversationList();
    }

    handleThreadSearch(query) {
        const conv = this.data.getCurrentConversation();
        if (conv) {
            this.renderPairs(conv.pairs, query);
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    toggleTitleEdit() {
        const input = document.getElementById('threadTitleInput');
        input.disabled = !input.disabled;
        if (!input.disabled) {
            input.focus();
            input.select();
        }
    }

    async saveTitleEdit() {
        const input = document.getElementById('threadTitleInput');
        input.disabled = true;

        if (this.data.currentConversationId) {
            const newTitle = input.value.trim();
            if (newTitle) {
                await this.data.updateConversationTitle(this.data.currentConversationId, newTitle);
                this.updateConversationList();
            }
        }
    }

    async deleteCurrentThread() {
        if (!this.data.currentConversationId) return;

        if (confirm('Are you sure you want to delete this entire conversation? This cannot be undone.')) {
            await this.data.deleteConversation(this.data.currentConversationId);
            this.updateUI();
        }
    }

    async deletePair(pairId) {
        if (!this.data.currentConversationId) return;

        if (confirm('Delete this message pair? This cannot be undone.')) {
            await this.data.deletePair(this.data.currentConversationId, pairId);
            this.updateMainView();
        }
    }

    async toggleStarConversation(id) {
        await this.data.toggleStarConversation(id);
        this.updateConversationList();
    }

    async toggleStarPair(pairId) {
        if (!this.data.currentConversationId) return;

        await this.data.toggleStarPair(this.data.currentConversationId, pairId);
        this.updateMainView();
    }

    saveProject() {
        const project = this.data.exportProject();
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chatgpt-parser-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async clearAllData() {
        await this.data.clearStorage();
        this.data.conversations = [];
        this.data.currentConversationId = null;
        this.updateUI();
    }

    formatMessageContent(content) {
        // First escape HTML to prevent XSS
        let formatted = this.escapeHtml(content);

        // Format code blocks first (before other markdown)
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
        });

        // Format inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Format tables BEFORE other processing
        formatted = formatted.replace(/^[ \t]*\|.*\|[ \t]*$/gm, (match) => {
            const cells = match.split('|').filter(c => c.trim() !== '');
            const cellTags = cells.map(cell => cell.trim().replace(/^:\-+:?$/, '---').includes('---')
                ? `<th>${cell.trim()}</th>`
                : `<td>${cell.trim()}</td>`).join('');
            return `<tr>${cellTags}</tr>`;
        });

        // Wrap table rows in table tags (this is simplified - proper table parsing is complex)
        formatted = formatted.replace(/(<tr>.*<\/tr>\s*)+/g, '<table>$&</table>');

        // Format headers (but not if they're indented with 4+ spaces)
        formatted = formatted.replace(/^(?! {4})### (.*$)/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^(?! {4})## (.*$)/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^(?! {4})# (.*$)/gm, '<h1>$1</h1>');

        // Format bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Format italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Format horizontal rules
        formatted = formatted.replace(/^---$/gm, '<hr>');

        // Format lists - simpler approach to avoid indentation issues
        // Split by double newlines first to preserve list blocks
        const blocks = formatted.split(/\n\n/);

        formatted = blocks.map(block => {
            // Skip table blocks
            if (block.includes('<table>')) return block;

            const lines = block.split('\n');
            let result = [];
            let inList = false;
            let listType = null; // 'ul' or 'ol'

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const isUlItem = /^[\-\*]\s/.test(line);
                const isOlItem = /^\d+\.\s/.test(line);

                if (isUlItem || isOlItem) {
                    const currentListType = isUlItem ? 'ul' : 'ol';
                    const itemContent = line.replace(/^[\-\*\d]+\.\s/, '');

                    // Start new list if needed
                    if (!inList || currentListType !== listType) {
                        if (inList) result.push(`</${listType}>`);
                        result.push(`<${currentListType}>`);
                        listType = currentListType;
                        inList = true;
                    }

                    result.push(`<li>${itemContent}</li>`);
                } else {
                    // Close list if we were in one
                    if (inList) {
                        result.push(`</${listType}>`);
                        inList = false;
                        listType = null;
                    }
                    result.push(line);
                }
            }

            // Close list if still open at end
            if (inList) {
                result.push(`</${listType}>`);
            }

            return result.join('\n');
        }).join('\n\n');

        // Split into paragraphs (double line breaks)
        let paragraphs = formatted.split(/\n\n/);

        // Process each paragraph
        paragraphs = paragraphs.map(para => {
            // Skip empty paragraphs
            if (!para.trim()) return '';

            // Skip if this is already HTML (lists, headers, code blocks, hr, tables)
            if (para.match(/^(<[huol]|<pre|<li|<table)/)) {
                return para;
            }

            // Preserve leading indentation (4 spaces or more) for code blocks
            if (para.match(/^(    |\t)/m)) {
                // Remove the leading 4 spaces from each line but preserve formatting
                const lines = para.split('\n');
                const trimmedLines = lines.map(line => line.replace(/^    /, ''));
                return `<pre style="white-space: pre-wrap;">${trimmedLines.join('\n')}</pre>`;
            }

            // Regular paragraph - convert single line breaks to <br>
            return `<p>${para.replace(/\n/g, '<br>')}</p>`;
        });

        // Join all paragraphs and filter out empty ones
        formatted = paragraphs.filter(p => p).join('\n');

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return date.toLocaleDateString();
    }

    formatDateTime(date) {
        return date.toLocaleString();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatGPTParserApp();
});
