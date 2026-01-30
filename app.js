// Main Application Controller

class ChatGPTParserApp {
    constructor() {
        this.data = chatData;
        this.currentView = 'upload'; // 'upload' or 'chat'
        this.searchResults = [];
        this.currentSort = 'newestCreated'; // Default sort option
        this.highlightedPairId = null; // For starred pair highlighting

        // Thread search state
        this.searchMatches = []; // Array of match elements
        this.currentMatchIndex = -1; // Current highlighted match
        this.searchQuery = ''; // Current search query

        // Date filter state
        this.dateFilter = {
            active: false,
            type: 'createTime', // 'createTime', 'updateTime', 'hasMessagesInRange'
            startDate: null,
            endDate: null
        };

        // Question navigation state
        this.currentPairs = []; // Store current conversation pairs
        this.currentQuestionIndex = -1; // Track current visible question
        this.questionScrollTimeout = null; // Debounce for scroll detection

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
        // Top navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.openTab(tabName, tab);
            });
        });

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

        // Filter button
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.showDateFilterDialog();
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

        document.getElementById('threadSearchInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.highlightPreviousMatch();
                } else {
                    this.highlightNextMatch();
                }
            } else if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
                e.preventDefault();
                this.highlightNextMatch();
            }
        });

        // Search navigation buttons
        document.getElementById('searchNextBtn').addEventListener('click', () => {
            this.highlightNextMatch();
        });

        document.getElementById('searchPrevBtn').addEventListener('click', () => {
            this.highlightPreviousMatch();
        });

        document.getElementById('searchCloseBtn').addEventListener('click', () => {
            this.clearThreadSearch();
        });

        // Question navigator
        document.getElementById('questionSelect').addEventListener('change', (e) => {
            this.jumpToQuestion(e.target.value);
        });

        document.getElementById('firstQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('first');
        });

        document.getElementById('prevQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('prev');
        });

        document.getElementById('nextQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('next');
        });

        document.getElementById('lastQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('last');
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

        // New Folder button
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            this.showNewFolderDialog();
        });

        // Context menus
        this.initializeContextMenus();

        // Close context menus on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideAllContextMenus();
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
        const allWarnings = [];

        for (const file of files) {
            try {
                const content = await file.text();
                let conversations = [];
                let warnings = [];

                if (file.name.endsWith('.json')) {
                    const jsonData = JSON.parse(content);
                    const result = this.data.parseJSONExport(jsonData);
                    conversations = result.conversations;
                    warnings = result.warnings;
                } else if (file.name.endsWith('.html')) {
                    conversations = this.data.parseHTMLExport(content);
                }

                totalConversations.push(...conversations);
                allWarnings.push(...warnings);
            } catch (error) {
                console.error('Error parsing file', file.name, ':', error);
                alert(`Error parsing file: ${file.name}\n\n${error.message}`);
            }
        }

        // Log warnings if any
        if (allWarnings.length > 0) {
            console.warn('Import warnings:', allWarnings);
        }

        if (totalConversations.length > 0) {
            await this.data.addConversations(totalConversations);
            alert(`Successfully imported ${totalConversations.length} conversation(s)!${allWarnings.length > 0 ? `\n\n(${allWarnings.length} warning(s) - see console for details)` : ''}`);
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

        // Add right-click context menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showConversationContextMenu(e, conv.id);
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
        this.clearThreadSearch();

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
            this.populateQuestionNavigator(conv.pairs);

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

        // Set up scroll observer to track visible question
        this.setupScrollObserver();
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
                    <div class="message-text">${this.formatMessageContent(answer.content, answer)}</div>
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
        // Check if this is a markdown artifact
        const isMarkdown = type.includes('markdown') || type.includes('md');

        if (isMarkdown) {
            // For markdown artifacts, format the markdown properly
            return `<div class="message-text">${this.formatMessageContent(content)}</div>`;
        }

        // For code artifacts, escape HTML and wrap in code block
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
        }

        // Format as code block with syntax highlighting class
        return `
            <pre class="message-text"><code class="language-${language}">${escapedContent}</code></pre>
        `;
    }

    escapeHtml(text) {
        // Only escape the truly dangerous HTML characters
        // This prevents XSS while keeping quotes and apostrophes readable
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async selectConversation(id) {
        this.data.currentConversationId = id;
        await this.data.saveToStorage();
        this.updateUI();

        // Clear thread search
        this.clearThreadSearch();

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    handleGlobalSearch(query) {
        this.updateConversationList();
    }

    handleThreadSearch(query) {
        this.searchQuery = query;
        const conv = this.data.getCurrentConversation();

        if (!conv) return;

        // Clear previous highlights
        this.clearSearchHighlights();

        if (!query.trim()) {
            // Show all pairs if search is empty
            this.renderPairs(conv.pairs);
            this.hideSearchNav();
            return;
        }

        // Show all pairs first
        this.renderPairs(conv.pairs);

        // Then highlight matches
        this.highlightSearchResults(query);
        this.showSearchNav();
    }

    highlightSearchResults(query) {
        const messagesContainer = document.getElementById('messagesContainer');
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        this.searchMatches = [];

        // Find all text nodes in message elements
        const walker = document.createTreeWalker(
            messagesContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Only search in message text, not in buttons or metadata
                    if (node.parentElement.closest('.message-actions, .model-badge, button')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToHighlight = [];
        let node;
        while (node = walker.nextNode()) {
            if (regex.test(node.textContent)) {
                nodesToHighlight.push(node);
            }
        }

        // Apply highlighting
        nodesToHighlight.forEach(textNode => {
            const fragment = document.createDocumentFragment();
            let lastIdx = 0;
            let match;

            // Reset regex for this node
            regex.lastIndex = 0;

            while ((match = regex.exec(textNode.textContent)) !== null) {
                // Add text before match
                fragment.appendChild(document.createTextNode(textNode.textContent.slice(lastIdx, match.index)));

                // Add highlighted match
                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'search-highlight';
                highlightSpan.textContent = match[0];
                highlightSpan.dataset.matchIndex = this.searchMatches.length;
                fragment.appendChild(highlightSpan);
                this.searchMatches.push(highlightSpan);

                lastIdx = match.index + match[0].length;
            }

            // Add remaining text
            if (lastIdx < textNode.textContent.length) {
                fragment.appendChild(document.createTextNode(textNode.textContent.slice(lastIdx)));
            }

            textNode.parentNode.replaceChild(fragment, textNode);
        });

        // Update match count
        this.updateMatchCount();

        // Highlight first match
        if (this.searchMatches.length > 0) {
            this.highlightMatch(0);
        }
    }

    clearSearchHighlights() {
        // Remove all highlight spans
        document.querySelectorAll('.search-highlight').forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize(); // Merge adjacent text nodes
        });

        this.searchMatches = [];
        this.currentMatchIndex = -1;
    }

    highlightMatch(index) {
        if (this.searchMatches.length === 0) return;

        // Remove active class from current match
        if (this.currentMatchIndex >= 0 && this.currentMatchIndex < this.searchMatches.length) {
            this.searchMatches[this.currentMatchIndex].classList.remove('active');
        }

        // Set new match
        this.currentMatchIndex = index;
        const matchElement = this.searchMatches[index];
        matchElement.classList.add('active');

        // Scroll to match
        matchElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Update match count
        this.updateMatchCount();
    }

    highlightNextMatch() {
        if (this.searchMatches.length === 0) return;

        const nextIndex = (this.currentMatchIndex + 1) % this.searchMatches.length;
        this.highlightMatch(nextIndex);
    }

    highlightPreviousMatch() {
        if (this.searchMatches.length === 0) return;

        const prevIndex = (this.currentMatchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
        this.highlightMatch(prevIndex);
    }

    updateMatchCount() {
        const countEl = document.getElementById('searchMatchCount');
        if (countEl) {
            const current = this.currentMatchIndex >= 0 ? this.currentMatchIndex + 1 : 0;
            countEl.textContent = `${current}/${this.searchMatches.length}`;
        }
    }

    showSearchNav() {
        const nav = document.getElementById('searchNavControls');
        if (nav) {
            nav.style.display = this.searchMatches.length > 0 ? 'flex' : 'none';
        }
    }

    hideSearchNav() {
        const nav = document.getElementById('searchNavControls');
        if (nav) {
            nav.style.display = 'none';
        }
    }

    clearThreadSearch() {
        document.getElementById('threadSearchInput').value = '';
        this.searchQuery = '';
        this.clearSearchHighlights();
        this.hideSearchNav();

        const conv = this.data.getCurrentConversation();
        if (conv) {
            this.renderPairs(conv.pairs);
        }
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    formatMessageContent(content, answer = null) {
        let formatted = content;

        // Process ChatGPT citations if answer metadata is available
        if (answer && answer.metadata && answer.metadata.content_references) {
            const citations = answer.metadata.content_references;

            // Replace each citation marker with a clickable link
            citations.forEach((citation, index) => {
                if (citation.matched_text && citation.items && citation.items.length > 0) {
                    const item = citation.items[0];
                    const url = item.url;
                    const title = item.title || item.attribution || 'Source';

                    // Create clickable link with the title
                    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link" title="${title}">[${index + 1}]</a>`;

                    // Replace the citation marker with the link
                    formatted = formatted.replace(citation.matched_text, linkHtml);
                }
            });
        }

        // Protect LaTeX sections by temporarily replacing them with placeholders
        const katexPlaceholders = [];

        // Block math: \[...\] or $$...$$
        formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
                    const placeholder = `__KATEX_BLOCK_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
                    const placeholder = `__KATEX_BLOCK_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        // Inline math: \(...\) or $...$
        formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                    const placeholder = `__KATEX_INLINE_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        formatted = formatted.replace(/\$([^$\n]+?)\$/g, (match, math) => {
            try {
                if (typeof katex !== 'undefined') {
                    const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
                    const placeholder = `__KATEX_INLINE_${katexPlaceholders.length}__`;
                    katexPlaceholders.push(html);
                    return placeholder;
                }
            } catch (e) {
                console.error('KaTeX error:', e);
            }
            return match;
        });

        // Convert URLs to clickable links
        // This matches http://, https://, and www. URLs (but not already in markdown links)
        formatted = formatted.replace(/(^|\s)(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, (match, prefix, url) => {
            // Remove trailing punctuation
            const cleanUrl = url.replace(/[.,;:!?)\]]+$/, '');

            // If URL starts with www., add https://
            const fullUrl = cleanUrl.startsWith('www.') ? 'https://' + cleanUrl : cleanUrl;

            // Extract domain for display
            let displayUrl = cleanUrl;
            try {
                const urlObj = new URL(fullUrl);
                // For very long URLs, truncate the path
                if (cleanUrl.length > 50) {
                    displayUrl = urlObj.hostname + '/...';
                }
            } catch (e) {
                // Invalid URL, use as-is
            }

            return `${prefix}<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="message-link">${displayUrl}</a>`;
        });

        // Format code blocks first (before other markdown)
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
        });

        // Format inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Format tables - simple and safe approach
        // First, identify table blocks (consecutive lines with |)
        const lines = formatted.split('\n');
        let result = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const isTableRow = line.trim().match(/^\|.*\|$/);

            if (isTableRow) {
                // Start of table
                let tableLines = [];
                let separatorSeen = false;

                // Collect all consecutive table rows
                while (i < lines.length && lines[i].trim().match(/^\|.*\|$/)) {
                    const row = lines[i].trim();
                    // Check if this is a separator row
                    if (row.includes('---')) {
                        separatorSeen = true;
                        i++; // Skip separator row
                        continue;
                    }
                    tableLines.push(row);
                    i++;
                }

                // Only process as table if we have a separator and data rows
                if (separatorSeen && tableLines.length > 0) {
                    // Build table HTML
                    result.push('<table>');
                    tableLines.forEach(rowLine => {
                        const cells = rowLine.split('|').filter(c => c.trim() !== '');
                        const cellTags = cells.map(cell => `<td>${cell.trim()}</td>`).join('');
                        result.push(`<tr>${cellTags}</tr>`);
                    });
                    result.push('</table>');
                } else {
                    // Not a valid table, just output the lines
                    result.push(...tableLines);
                }
            } else {
                result.push(line);
                i++;
            }
        }

        formatted = result.join('\n');

        // Format headers (h1-h6, but not if they're indented with 4+ spaces)
        formatted = formatted.replace(/^(?! {4})###### (.*$)/gm, '<h6>$1</h6>');
        formatted = formatted.replace(/^(?! {4})##### (.*$)/gm, '<h5>$1</h5>');
        formatted = formatted.replace(/^(?! {4})#### (.*$)/gm, '<h4>$1</h4>');
        formatted = formatted.replace(/^(?! {4})### (.*$)/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^(?! {4})## (.*$)/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^(?! {4})# (.*$)/gm, '<h1>$1</h1>');

        // Format bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Format italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Format horizontal rules (must be on its own line, not part of a table or code)
        formatted = formatted.replace(/^(?!.*\|)(?!.*<tr)(?!.*<pre)(?!.*<code)---$/gm, '<hr>');

        // Format blockquotes - process before other markdown
        // Handle both single and multi-line blockquotes
        const blockquoteLines = formatted.split('\n');
        let blockquoteResult = [];
        let inBlockquote = false;
        let blockquoteContent = [];

        for (let line of blockquoteLines) {
            const isBlockquote = /^>\s+(.*)/.test(line);

            if (isBlockquote) {
                const content = line.replace(/^>\s+/, '');
                blockquoteContent.push(content);
                inBlockquote = true;
            } else {
                if (inBlockquote) {
                    blockquoteResult.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
                    blockquoteContent = [];
                    inBlockquote = false;
                }
                blockquoteResult.push(line);
            }
        }

        // Close any open blockquote at the end
        if (inBlockquote) {
            blockquoteResult.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
        }

        formatted = blockquoteResult.join('\n');

        // Format lists - process entire text at once, not in blocks
        // This preserves list continuity across blank lines
        const listLines = formatted.split('\n');
        let listResult = [];
        let listIdx = 0;

        while (listIdx < listLines.length) {
            const line = listLines[listIdx];
            const isUlItem = /^[\-\*]\s+(.*)/.test(line);
            const isOlItem = /^\d+\.\s+(.*)/.test(line);

            if (isUlItem || isOlItem) {
                const currentListType = isUlItem ? 'ul' : 'ol';
                const listItems = [];

                // Keep consuming list items (even with blank lines between them)
                while (listIdx < listLines.length) {
                    const listLine = listLines[listIdx];
                    const isListItemUl = /^[\-\*]\s+(.*)/.test(listLine);
                    const isListItemOl = /^\d+\.\s+(.*)/.exec(listLine);

                    if (isListItemUl) {
                        const itemContent = listLine.replace(/^[\-\*]\s+/, '');
                        listItems.push(`<li>${itemContent}</li>`);
                        listIdx++;
                    } else if (isListItemOl) {
                        // Preserve the original number from markdown
                        const number = isListItemOl[1]; // Get the content after "N. "
                        const marker = listLine.match(/^\d+\./)[0]; // Get just the "N." part
                        listItems.push(`<li><span class="list-number">${marker}</span> ${number}</li>`);
                        listIdx++;
                    } else if (listLine.trim() === '') {
                        // Blank line - continue, this is allowed in markdown lists
                        listIdx++;
                    } else {
                        // Non-list, non-empty line - end of list
                        break;
                    }
                }

                // Join list items without newlines to prevent them being split into separate paragraphs
                listResult.push(`<${currentListType}>${listItems.join('')}</${currentListType}>`);
            } else {
                listResult.push(line);
                listIdx++;
            }
        }

        formatted = listResult.join('\n\n');

        // Split into paragraphs (double line breaks)
        // But don't split inside lists - split by \n\n and then recombine list parts
        let paragraphs = formatted.split(/\n\n/);
        let processedParagraphs = [];
        let paraIdx = 0;

        while (paraIdx < paragraphs.length) {
            const para = paragraphs[paraIdx];

            // If this paragraph starts with an unclosed list tag, find the closing tag
            if ((para.startsWith('<ul>') || para.startsWith('<ol>')) && !para.includes('</ul>') && !para.includes('</ol>')) {
                // Combine paragraphs until we find the closing tag
                let combined = para;
                paraIdx++;
                while (paraIdx < paragraphs.length && !combined.includes('</ul>') && !combined.includes('</ol>')) {
                    combined += '\n\n' + paragraphs[paraIdx];
                    paraIdx++;
                }
                processedParagraphs.push(combined);
            } else if (!para.trim()) {
                // Skip empty paragraphs
                paraIdx++;
            } else {
                processedParagraphs.push(para);
                paraIdx++;
            }
        }

        // Now process each paragraph
        paragraphs = processedParagraphs.map(para => {
            // Skip if this is already HTML (lists, headers, code blocks, hr, tables, blockquotes)
            if (para.match(/^(<[huol]|<pre|<li|<table|<blockquote)/)) {
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

        // Restore KaTeX placeholders with actual rendered HTML
        formatted = formatted.replace(/__KATEX_(BLOCK|INLINE)_(\d+)__/g, (match, type, index) => {
            return katexPlaceholders[parseInt(index)] || match;
        });

        return formatted;
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

    // =========================================================================
    // FOLDER METHODS
    // =========================================================================

    /**
     * Initialize context menus for conversations and folders
     */
    initializeContextMenus() {
        // Conversation context menu
        const conversationContextMenu = document.getElementById('conversationContextMenu');
        conversationContextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'move') {
                this.showMoveToSubmenu(e.target);
            }
        });

        // Folder context menu
        const folderContextMenu = document.getElementById('folderContextMenu');
        folderContextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const folderId = folderContextMenu.dataset.folderId;
            if (action === 'rename') {
                this.renameFolder(folderId);
            } else if (action === 'color') {
                this.showColorSubmenu(e.target, folderId);
            } else if (action === 'delete') {
                this.deleteFolder(folderId);
            }
        });

        // Move to submenu
        const moveToSubmenu = document.getElementById('moveToSubmenu');
        moveToSubmenu.addEventListener('click', (e) => {
            const folderId = e.target.dataset.folder;
            if (folderId !== undefined) {
                this.moveConversationToFolder(folderId);
            }
        });

        // Color submenu
        const colorSubmenu = document.getElementById('colorSubmenu');
        colorSubmenu.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            if (color) {
                const folderId = colorSubmenu.dataset.folderId;
                this.selectFolderColor(folderId, color);
            }
        });

        // New folder dialog
        document.getElementById('cancelNewFolder').addEventListener('click', () => {
            this.hideNewFolderDialog();
        });

        document.getElementById('confirmNewFolder').addEventListener('click', () => {
            this.createNewFolder();
        });

        // Date filter dialog
        document.getElementById('cancelDateFilter').addEventListener('click', () => {
            this.hideDateFilterDialog();
        });

        document.getElementById('resetDateFilter').addEventListener('click', () => {
            this.resetDateFilter();
        });

        document.getElementById('applyDateFilter').addEventListener('click', () => {
            this.applyDateFilter();
        });
    }

    // =========================================================================
    // DATE FILTER METHODS
    // =========================================================================

    /**
     * Show date filter dialog
     */
    showDateFilterDialog() {
        const dialog = document.getElementById('dateFilterDialog');
        dialog.style.display = 'flex';

        // Set current filter type
        const radioButtons = document.querySelectorAll('input[name="filterType"]');
        radioButtons.forEach(radio => {
            if (radio.value === this.dateFilter.type) {
                radio.checked = true;
            }
        });

        // Set current date values
        if (this.dateFilter.startDate) {
            document.getElementById('startDate').value = this.dateFilter.startDate;
        }
        if (this.dateFilter.endDate) {
            document.getElementById('endDate').value = this.dateFilter.endDate;
        }
    }

    /**
     * Hide date filter dialog
     */
    hideDateFilterDialog() {
        document.getElementById('dateFilterDialog').style.display = 'none';
    }

    /**
     * Reset date filter
     */
    resetDateFilter() {
        this.dateFilter = {
            active: false,
            type: 'createTime',
            startDate: null,
            endDate: null
        };

        // Clear inputs
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';

        // Remove active state from button
        document.getElementById('filterBtn').classList.remove('active');

        // Update conversation list
        this.updateConversationList();

        this.hideDateFilterDialog();
    }

    /**
     * Apply date filter
     */
    applyDateFilter() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const filterType = document.querySelector('input[name="filterType"]:checked').value;

        // Validate dates
        if (!startDate && !endDate) {
            alert('Please select at least one date');
            return;
        }

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            alert('Start date must be before end date');
            return;
        }

        // Set filter state
        this.dateFilter = {
            active: true,
            type: filterType,
            startDate: startDate || null,
            endDate: endDate || null
        };

        // Add active state to button
        document.getElementById('filterBtn').classList.add('active');

        // Update conversation list
        this.updateConversationList();

        this.hideDateFilterDialog();
    }

    /**
     * Check if conversation matches date filter
     */
    matchesDateFilter(conv) {
        if (!this.dateFilter.active) {
            return true;
        }

        const startTimestamp = this.dateFilter.startDate ?
            new Date(this.dateFilter.startDate).getTime() / 1000 : 0;
        const endTimestamp = this.dateFilter.endDate ?
            new Date(this.dateFilter.endDate).getTime() / 1000 + 86400 : // End of day
            Infinity;

        switch (this.dateFilter.type) {
            case 'createTime':
                return conv.createTime >= startTimestamp && conv.createTime <= endTimestamp;

            case 'updateTime':
                return conv.updateTime >= startTimestamp && conv.updateTime <= endTimestamp;

            case 'hasMessagesInRange':
                // First check if conversation range overlaps with filter range
                if (conv.updateTime < startTimestamp || conv.createTime > endTimestamp) {
                    return false;
                }

                // Then check individual message timestamps
                return this.hasMessagesInRange(conv, startTimestamp, endTimestamp);

            default:
                return true;
        }
    }

    /**
     * Check if conversation has messages within date range
     */
    hasMessagesInRange(conv, startTimestamp, endTimestamp) {
        // Check timestamps in all pairs
        for (const pair of conv.pairs) {
            // Check question timestamp
            if (pair.question.timestamp &&
                pair.question.timestamp >= startTimestamp &&
                pair.question.timestamp <= endTimestamp) {
                return true;
            }

            // Check answer timestamps
            for (const answer of pair.answers) {
                if (answer.timestamp &&
                    answer.timestamp >= startTimestamp &&
                    answer.timestamp <= endTimestamp) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Render custom folders in sidebar
     */
    renderCustomFolders() {
        const container = document.getElementById('customFoldersContainer');

        // Check if we need to do full rebuild or just update
        const existingFolderIds = Array.from(container.querySelectorAll('.custom-folder'))
            .map(el => el.dataset.folderId);

        const sortedFolders = [...this.data.folders].sort((a, b) => a.order - b.order);
        const currentFolderIds = sortedFolders.map(f => f.id);

        // Full rebuild only if folder structure changed (folders added/removed/reordered)
        const needsRebuild = !this.arraysEqual(existingFolderIds, currentFolderIds);

        if (needsRebuild) {
            // Full rebuild
            container.innerHTML = '';

            sortedFolders.forEach(folder => {
                const conversations = this.data.getConversationsInFolder(folder.id);
                const folderDiv = document.createElement('div');
                folderDiv.className = 'custom-folder';
                folderDiv.dataset.folderId = folder.id;

                folderDiv.innerHTML = `
                    <div class="custom-folder-header" data-folder-id="${folder.id}">
                        <span class="folder-color-indicator" style="background-color: ${folder.color}"></span>
                        <span class="folder-title">${this.escapeHtml(folder.name)}</span>
                        <span class="folder-count">(${conversations.length})</span>
                    </div>
                    <div class="folder-content collapsed" id="folderContent_${folder.id}">
                        <!-- Conversations will be rendered here -->
                    </div>
                `;

                // Add click handler for expanding/collapsing
                const header = folderDiv.querySelector('.custom-folder-header');
                header.addEventListener('click', (e) => {
                    if (!e.target.closest('.context-menu')) {
                        const content = document.getElementById(`folderContent_${folder.id}`);
                        content.classList.toggle('collapsed');
                    }
                });

                // Add right-click handler
                header.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showFolderContextMenu(e, folder.id);
                });

                container.appendChild(folderDiv);
            });
        } else {
            // Just update counts, not structure
            sortedFolders.forEach(folder => {
                const folderDiv = container.querySelector(`.custom-folder[data-folder-id="${folder.id}"]`);
                if (folderDiv) {
                    const countEl = folderDiv.querySelector('.folder-count');
                    const conversations = this.data.getConversationsInFolder(folder.id);
                    countEl.textContent = `(${conversations.length})`;
                }
            });
        }
    }

    /**
     * Helper to compare arrays
     */
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    /**
     * Update conversation list to include folders
     */
    updateConversationList() {
        // Get all conversations
        let allConversations = this.data.conversations;

        // Apply date filter first
        if (this.dateFilter.active) {
            allConversations = allConversations.filter(conv => this.matchesDateFilter(conv));
        }

        // Get starred conversations from filtered list
        const starredConversations = allConversations.filter(conv => conv.starred);

        // Get starred pairs (from all conversations, not filtered)
        const allStarredPairs = this.data.getStarredPairs();

        // Apply search filter if active
        const searchQuery = document.getElementById('globalSearchInput').value.trim();

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            allConversations = allConversations.filter(conv => {
                if (conv.title.toLowerCase().includes(lowerQuery)) {
                    return true;
                }
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

        // Render system folders
        this.renderConversationFolder(
            document.getElementById('allConversationsContent'),
            sortedAll,
            searchQuery
        );

        this.renderConversationFolder(
            document.getElementById('starredConversationsContent'),
            sortedStarred,
            searchQuery
        );

        this.renderStarredPairsFolder(
            document.getElementById('starredPairsContent'),
            allStarredPairs,
            searchQuery
        );

        // Render custom folders
        this.renderCustomFolders();
        this.renderCustomFolderContent(sortedAll, searchQuery);
    }

    /**
     * Render conversation content in custom folders
     */
    renderCustomFolderContent(conversations, searchQuery) {
        const sortedFolders = [...this.data.folders].sort((a, b) => a.order - b.order);

        sortedFolders.forEach(folder => {
            const folderConversations = this.data.getConversationsInFolder(folder.id);
            const content = document.getElementById(`folderContent_${folder.id}`);

            if (!content) return;

            content.innerHTML = '';

            if (folderConversations.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `<p>Empty folder</p>`;
                content.appendChild(emptyState);
                return;
            }

            // Filter by search query if active
            let filteredConversations = folderConversations;
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                filteredConversations = folderConversations.filter(conv =>
                    conv.title.toLowerCase().includes(lowerQuery) ||
                    conv.pairs.some(pair =>
                        pair.question.content.toLowerCase().includes(lowerQuery) ||
                        pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery))
                    )
                );
            }

            // Sort conversations
            const sorted = this.sortConversations(filteredConversations);

            sorted.forEach(conv => {
                const item = this.createConversationItem(conv);
                content.appendChild(item);
            });
        });
    }

    /**
     * Show new folder dialog
     */
    showNewFolderDialog() {
        const dialog = document.getElementById('newFolderDialog');
        dialog.style.display = 'flex';
        document.getElementById('newFolderName').value = '';
        document.getElementById('newFolderName').focus();

        // Reset color selection to default (purple)
        document.querySelectorAll('#presetColors .color-option').forEach(el => {
            el.classList.remove('selected');
        });
        const defaultColor = document.querySelector('#presetColors .color-option[data-color="#8b5cf6"]');
        if (defaultColor) {
            defaultColor.classList.add('selected');
        }

        // Add click handlers for color options (remove old handlers first)
        const colorOptions = document.querySelectorAll('#presetColors .color-option');
        colorOptions.forEach(option => {
            option.removeEventListener('click', this.handleColorOptionClick);
            option.addEventListener('click', this.handleColorOptionClick);
        });
    }

    /**
     * Handle color option click
     */
    handleColorOptionClick(e) {
        e.stopPropagation();
        document.querySelectorAll('#presetColors .color-option').forEach(el => {
            el.classList.remove('selected');
        });
        e.target.classList.add('selected');
    }

    /**
     * Hide new folder dialog
     */
    hideNewFolderDialog() {
        document.getElementById('newFolderDialog').style.display = 'none';
    }

    /**
     * Create new folder
     */
    async createNewFolder() {
        const nameInput = document.getElementById('newFolderName');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a folder name');
            return;
        }

        // Get selected color from preset options
        const selectedColorEl = document.querySelector('#presetColors .color-option.selected');
        const color = selectedColorEl ? selectedColorEl.dataset.color : '#8b5cf6';

        await this.data.createFolder(name, color);
        this.hideNewFolderDialog();
        this.updateConversationList();
    }

    /**
     * Show folder context menu
     */
    showFolderContextMenu(event, folderId) {
        const menu = document.getElementById('folderContextMenu');
        menu.dataset.folderId = folderId;
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.style.display = 'block';
    }

    /**
     * Show conversation context menu
     */
    showConversationContextMenu(event, conversationId) {
        const menu = document.getElementById('conversationContextMenu');
        menu.dataset.conversationId = conversationId;
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.style.display = 'block';
    }

    /**
     * Show "Move to" submenu
     */
    showMoveToSubmenu(menuItem) {
        const submenu = document.getElementById('moveToSubmenu');
        const rect = menuItem.getBoundingClientRect();

        // Build folder list
        let folderOptions = '<div class="context-menu-item" data-folder="all">📁 All Conversations</div>';

        this.data.folders.forEach(folder => {
            folderOptions += `<div class="context-menu-item" data-folder="${folder.id}">
                <span class="folder-color-dot" style="background-color: ${folder.color}"></span>
                ${this.escapeHtml(folder.name)}
            </div>`;
        });

        submenu.innerHTML = folderOptions;
        submenu.style.left = `${rect.right}px`;
        submenu.style.top = `${rect.top}px`;
        submenu.style.display = 'block';

        // Store conversation ID for move operation
        submenu.dataset.conversationId = document.getElementById('conversationContextMenu').dataset.conversationId;
    }

    /**
     * Hide all context menus
     */
    hideAllContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    /**
     * Move conversation to folder
     */
    async moveConversationToFolder(folderId) {
        const submenu = document.getElementById('moveToSubmenu');
        const conversationId = submenu.dataset.conversationId;

        if (conversationId) {
            // Convert 'all' to null (uncategorized)
            const targetFolderId = folderId === 'all' ? null : folderId;
            await this.data.moveConversationToFolder(conversationId, targetFolderId);
            this.updateConversationList();
        }

        this.hideAllContextMenus();
    }

    /**
     * Rename folder
     */
    async renameFolder(folderId) {
        const folder = this.data.getFolder(folderId);
        if (!folder) return;

        const newName = prompt('Enter new folder name:', folder.name);
        if (newName && newName.trim()) {
            await this.data.updateFolder(folderId, { name: newName.trim() });
            this.updateConversationList();
        }

        this.hideAllContextMenus();
    }

    /**
     * Show color selection submenu
     */
    showColorSubmenu(menuItem, folderId) {
        const submenu = document.getElementById('colorSubmenu');
        const rect = menuItem.getBoundingClientRect();
        const folder = this.data.getFolder(folderId);

        if (!folder) return;

        // Preset colors
        const colors = [
            { color: '#ef4444', name: 'Red' },
            { color: '#f97316', name: 'Orange' },
            { color: '#eab308', name: 'Yellow' },
            { color: '#22c55e', name: 'Green' },
            { color: '#3b82f6', name: 'Blue' },
            { color: '#8b5cf6', name: 'Purple' },
            { color: '#ec4899', name: 'Pink' },
            { color: '#6b7280', name: 'Gray' }
        ];

        // Build color options
        let colorOptions = '';
        colors.forEach(c => {
            const isSelected = c.color === folder.color ? 'selected' : '';
            colorOptions += `<div class="color-option ${isSelected}" data-color="${c.color}" style="background-color: ${c.color};" title="${c.name}"></div>`;
        });

        submenu.innerHTML = colorOptions;
        submenu.style.left = `${rect.right}px`;
        submenu.style.top = `${rect.top}px`;
        submenu.style.display = 'block';
        submenu.dataset.folderId = folderId;
    }

    /**
     * Select folder color from submenu
     */
    async selectFolderColor(folderId, color) {
        await this.data.updateFolder(folderId, { color: color });
        this.updateConversationList();
        this.hideAllContextMenus();
    }

    /**
     * Change folder color (deprecated - now uses showColorSubmenu)
     * Kept for backwards compatibility
     */
    async changeFolderColor(folderId) {
        const folder = this.data.getFolder(folderId);
        if (!folder) return;

        // Find the color menu item and trigger submenu
        const colorMenuItem = document.querySelector('#folderContextMenu [data-action="color"]');
        if (colorMenuItem) {
            this.showColorSubmenu(colorMenuItem, folderId);
        }
    }

    /**
     * Delete folder
     */
    async deleteFolder(folderId) {
        const folder = this.data.getFolder(folderId);
        if (!folder) return;

        if (confirm(`Delete folder "${folder.name}"? Conversations will be moved to All Conversations.`)) {
            await this.data.deleteFolder(folderId);
            this.updateConversationList();
        }

        this.hideAllContextMenus();
    }

    // =========================================================================
    // TOP NAVIGATION METHODS
    // =========================================================================

    /**
     * Open a tab panel
     */
    openTab(tabName, tabElement) {
        // Close any open panel first
        this.closeTabPanel();

        // Set active state on tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // Show corresponding panel
        const panel = document.getElementById(`${tabName}-panel`);
        if (panel) {
            panel.style.display = 'flex';
        }
    }

    /**
     * Close the currently open tab panel
     */
    closeTabPanel() {
        // Remove active state from all tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

        // Hide all panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.style.display = 'none';
        });
    }

    // =========================================================================
    // QUESTION NAVIGATOR METHODS
    // =========================================================================

    /**
     * Populate the question navigator dropdown with all questions
     */
    populateQuestionNavigator(pairs) {
        this.currentPairs = pairs;
        this.currentQuestionIndex = -1;

        const select = document.getElementById('questionSelect');
        select.innerHTML = '<option value="">Jump to question...</option>';

        pairs.forEach((pair) => {
            const option = document.createElement('option');
            const questionPreview = this.getQuestionPreview(pair.question.content, 60);
            option.value = pair.id;
            option.textContent = `#${pair.index} ${questionPreview}`;
            select.appendChild(option);
        });

        // Update button states
        this.updateQuestionNavButtons();
    }

    /**
     * Navigate to first, prev, next, or last question
     */
    navigateToQuestion(direction) {
        if (this.currentPairs.length === 0) return;

        let targetIndex = 0;

        switch (direction) {
            case 'first':
                targetIndex = 0;
                break;
            case 'prev':
                if (this.currentQuestionIndex > 0) {
                    targetIndex = this.currentQuestionIndex - 1;
                } else {
                    targetIndex = 0;
                }
                break;
            case 'next':
                if (this.currentQuestionIndex < this.currentPairs.length - 1) {
                    targetIndex = this.currentQuestionIndex + 1;
                } else {
                    targetIndex = this.currentPairs.length - 1;
                }
                break;
            case 'last':
                targetIndex = this.currentPairs.length - 1;
                break;
        }

        const targetPair = this.currentPairs[targetIndex];
        if (targetPair) {
            this.jumpToQuestion(targetPair.id);
            this.currentQuestionIndex = targetIndex;
            this.updateQuestionNavButtons();

            // Update dropdown to match
            document.getElementById('questionSelect').value = targetPair.id;
        }
    }

    /**
     * Update the enabled/disabled state of navigation buttons
     */
    updateQuestionNavButtons() {
        const firstBtn = document.getElementById('firstQuestionBtn');
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const lastBtn = document.getElementById('lastQuestionBtn');

        if (this.currentPairs.length === 0) {
            firstBtn.disabled = true;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            lastBtn.disabled = true;
            return;
        }

        firstBtn.disabled = false;
        lastBtn.disabled = false;
        prevBtn.disabled = this.currentQuestionIndex <= 0;
        nextBtn.disabled = this.currentQuestionIndex >= this.currentPairs.length - 1;
    }

    /**
     * Get a short preview of the question text
     */
    getQuestionPreview(content, maxLength) {
        // Strip HTML tags for preview
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const text = tempDiv.textContent || tempDiv.innerText || '';

        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Jump to a specific question by pair ID
     */
    jumpToQuestion(pairId) {
        if (!pairId) return;

        const pairElement = document.querySelector(`.pair-container[data-pair-id="${pairId}"]`);
        if (pairElement) {
            pairElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Highlight the pair temporarily
            pairElement.classList.add('highlighted-starred');
            setTimeout(() => {
                pairElement.classList.remove('highlighted-starred');
            }, 2000);

            // Update current question index
            const pairIndex = this.currentPairs.findIndex(p => p.id === pairId);
            if (pairIndex !== -1) {
                this.currentQuestionIndex = pairIndex;
            }
        }
    }

    /**
     * Set up IntersectionObserver to track which question is visible
     */
    setupScrollObserver() {
        // Remove existing observer if any
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
        }

        const options = {
            root: document.getElementById('messagesContainer'),
            rootMargin: '-20% 0px -60% 0px', // Trigger when element is near center top
            threshold: 0
        };

        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const pairId = entry.target.dataset.pairId;
                    const pairIndex = this.currentPairs.findIndex(p => p.id === pairId);

                    if (pairIndex !== -1 && pairIndex !== this.currentQuestionIndex) {
                        this.currentQuestionIndex = pairIndex;
                        this.updateQuestionNavButtons();

                        // Update dropdown without triggering change event
                        const select = document.getElementById('questionSelect');
                        select.value = pairId;
                    }
                }
            });
        }, options);

        // Observe all pair containers
        document.querySelectorAll('.pair-container').forEach(el => {
            this.scrollObserver.observe(el);
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatGPTParserApp();
});
