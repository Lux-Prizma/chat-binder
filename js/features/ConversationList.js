/**
 * ConversationList - Handles conversation list rendering and context menu attachment
 */

export class ConversationList {
    constructor(eventBus, data, contextMenu) {
        this.eventBus = eventBus;
        this.data = data;
        this.contextMenu = contextMenu;
    }

    render(allConversations, starredConversations, allStarredPairs) {
        // Update counts
        document.querySelector('#allConversationsFolder .folder-count').textContent = `(${allConversations.length})`;
        document.querySelector('#starredConversationsFolder .folder-count').textContent = `(${starredConversations.length})`;
        document.querySelector('#starredPairsFolder .folder-count').textContent = `(${allStarredPairs.length})`;

        // Render folders
        this.renderConversationFolder(document.getElementById('allConversationsContent'), allConversations);
        this.renderConversationFolder(document.getElementById('starredConversationsContent'), starredConversations);
        this.renderStarredPairsFolder(document.getElementById('starredPairsContent'), allStarredPairs);
    }

    renderConversationFolder(container, conversations) {
        container.innerHTML = '';

        if (conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No conversations</p>
                    <small>Import your ChatGPT export to get started</small>
                </div>
            `;
            return;
        }

        conversations.forEach(conv => {
            const item = this.createConversationItem(conv);
            container.appendChild(item);
        });
    }

    renderStarredPairsFolder(container, starredPairs) {
        container.innerHTML = '';

        if (starredPairs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No starred pairs yet</p>
                    <small>Star pairs to see them here</small>
                </div>
            `;
            return;
        }

        starredPairs.forEach((pair) => {
            const item = this.createStarredPairItem(pair);
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

        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <div class="conversation-item-title" title="${conv.title}">
                ${conv.title}
            </div>
            <span class="star-icon ${conv.starred ? 'starred' : ''}" data-id="${conv.id}">
                ${conv.starred ? '⭐' : '☆'}
            </span>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('star-icon')) {
                this.eventBus.emit('conversation:select', { id: conv.id });
            }
        });

        const starIcon = item.querySelector('.star-icon');
        starIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.eventBus.emit('conversation:star', { id: conv.id });
        });

        // Add right-click context menu
        item.addEventListener('contextmenu', (e) => {
            this.contextMenu.showConversationContextMenu(e, conv.id);
        });

        return item;
    }

    createStarredPairItem(pair) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.pairId = pair.id;
        item.dataset.conversationId = pair.conversationId;

        const previewText = pair.question.content.substring(0, 50);
        const truncatedText = previewText.length < pair.question.content.length
            ? previewText + '...'
            : previewText;

        item.innerHTML = `
            <span class="star-icon starred">💎</span>
            <div class="conversation-item-title" title="${pair.question.content}">
                ${truncatedText}
            </div>
            <small style="color: var(--text-muted);">from "${pair.conversationTitle}"</small>
        `;

        item.addEventListener('click', () => {
            this.eventBus.emit('conversation:selectWithPair', { conversationId: pair.conversationId, pairId: pair.id });
        });

        return item;
    }
}
