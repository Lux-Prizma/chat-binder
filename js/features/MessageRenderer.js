/**
 * MessageRenderer - Handles rendering of message pairs and markdown formatting
 */

import { MarkdownParser } from '../utils/MarkdownParser.js';
import { DateUtils } from '../utils/DateUtils.js';
import { HtmlUtils } from '../utils/HtmlUtils.js';

export class MessageRenderer {
    constructor(eventBus, data) {
        this.eventBus = eventBus;
        this.data = data;
        this.searchMatches = [];
        this.currentMatchIndex = -1;
        this.searchQuery = '';

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('search:clear', () => this.clearThreadSearch());
        this.eventBus.on('search:query', (data) => this.handleThreadSearch(data.query));
        this.eventBus.on('search:next', () => this.highlightNextMatch());
        this.eventBus.on('search:prev', () => this.highlightPreviousMatch());
    }

    /**
     * Render message pairs
     */
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

    /**
     * Create a pair element (question + answers)
     */
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

        // Create answer element(s)
        if (pair.answers.length === 0) {
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

    /**
     * Create question element
     */
    createQuestionElement(question, index) {
        const div = document.createElement('div');
        div.className = 'message user';

        const content = MarkdownParser.format(question.content);

        div.innerHTML = `
            <div class="message-content">
                <div class="message-index">${index}</div>
                <div class="message-body">
                    <div class="message-text">${content}</div>
                </div>
            </div>
        `;

        return div;
    }

    /**
     * Create answer element
     */
    createAnswerElement(answer, pairId, isStarred, showActions) {
        const container = document.createElement('div');
        container.className = 'message assistant';

        const timestamp = DateUtils.timestampToDate(answer.timestamp);
        const timestampStr = DateUtils.formatDateTime(timestamp);
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
                        <div class="message-text">${MarkdownParser.format(answer.thinking)}</div>
                    </div>
                </div>
            `;
        }

        // Build artifact sections HTML if present
        let artifactsHtml = '';
        if (answer.artifacts && answer.artifacts.length > 0) {
            answer.artifacts.forEach((artifact) => {
                const formattedContent = this.formatArtifactContent(artifact.type, artifact.content);
                artifactsHtml += `
                    <div class="thinking-section">
                        <button class="thinking-toggle" onclick="this.parentElement.classList.toggle('collapsed')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                            <span>📦 Artifact: ${HtmlUtils.escapeHtml(artifact.title)}</span>
                        </button>
                        <div class="thinking-content">
                            ${formattedContent}
                        </div>
                    </div>
                `;
            });
        }

        const content = MarkdownParser.format(answer.content, answer);

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
                    <div class="message-text">${content}</div>
                    ${actionsHtml}
                </div>
            </div>
        `;

        // Add event listeners for actions
        if (showActions) {
            const deleteBtn = container.querySelector('.delete');
            deleteBtn.addEventListener('click', () => {
                this.eventBus.emit('pair:delete', { pairId });
            });

            const starBtn = container.querySelector('.star');
            starBtn.addEventListener('click', () => {
                this.eventBus.emit('pair:star', { pairId });
            });

            const thinkingToggle = container.querySelector('.thinking-toggle');
            if (thinkingToggle) {
                thinkingToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }

        return container;
    }

    /**
     * Format artifact content
     */
    formatArtifactContent(type, content) {
        const isMarkdown = type.includes('markdown') || type.includes('md');

        if (isMarkdown) {
            return `<div class="message-text">${MarkdownParser.format(content)}</div>`;
        }

        const escapedContent = HtmlUtils.escapeHtml(content);

        let language = 'text';
        if (type.includes('html')) language = 'html';
        else if (type.includes('json')) language = 'json';
        else if (type.includes('javascript') || type.includes('js')) language = 'javascript';
        else if (type.includes('python') || type.includes('py')) language = 'python';
        else if (type.includes('css')) language = 'css';

        return `
            <pre class="message-text"><code class="language-${language}">${escapedContent}</code></pre>
        `;
    }

    /**
     * Handle thread search
     */
    handleThreadSearch(query) {
        this.searchQuery = query;
        const conv = this.data.getCurrentConversation();

        if (!conv) return;

        this.clearSearchHighlights();

        if (!query.trim()) {
            this.renderPairs(conv.pairs);
            this.hideSearchNav();
            return;
        }

        this.renderPairs(conv.pairs);
        this.highlightSearchResults(query);
        this.showSearchNav();
    }

    /**
     * Highlight search results
     */
    highlightSearchResults(query) {
        const messagesContainer = document.getElementById('messagesContainer');
        const regex = new RegExp(`(${HtmlUtils.escapeRegex(query)})`, 'gi');
        this.searchMatches = [];

        const walker = document.createTreeWalker(
            messagesContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
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

        nodesToHighlight.forEach(textNode => {
            const fragment = document.createDocumentFragment();
            let lastIdx = 0;
            let match;

            regex.lastIndex = 0;

            while ((match = regex.exec(textNode.textContent)) !== null) {
                fragment.appendChild(document.createTextNode(textNode.textContent.slice(lastIdx, match.index)));

                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'search-highlight';
                highlightSpan.textContent = match[0];
                highlightSpan.dataset.matchIndex = this.searchMatches.length;
                fragment.appendChild(highlightSpan);
                this.searchMatches.push(highlightSpan);

                lastIdx = match.index + match[0].length;
            }

            if (lastIdx < textNode.textContent.length) {
                fragment.appendChild(document.createTextNode(textNode.textContent.slice(lastIdx)));
            }

            textNode.parentNode.replaceChild(fragment, textNode);
        });

        this.updateMatchCount();

        if (this.searchMatches.length > 0) {
            this.highlightMatch(0);
        }
    }

    /**
     * Clear search highlights
     */
    clearSearchHighlights() {
        document.querySelectorAll('.search-highlight').forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });

        this.searchMatches = [];
        this.currentMatchIndex = -1;
    }

    /**
     * Highlight a specific match
     */
    highlightMatch(index) {
        if (this.searchMatches.length === 0) return;

        if (this.currentMatchIndex >= 0 && this.currentMatchIndex < this.searchMatches.length) {
            this.searchMatches[this.currentMatchIndex].classList.remove('active');
        }

        this.currentMatchIndex = index;
        const matchElement = this.searchMatches[index];
        matchElement.classList.add('active');

        matchElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Find the parent pair-container and emit event to update question navigator
        const pairContainer = matchElement.closest('.pair-container');
        if (pairContainer) {
            const pairId = pairContainer.dataset.pairId;
            if (pairId) {
                this.eventBus.emit('question:navigate', { pairId });
            }
        }

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

    set highlightedPairId(pairId) {
        this._highlightedPairId = pairId;
    }

    get highlightedPairId() {
        return this._highlightedPairId;
    }
}
