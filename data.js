// Data Module for ChatGPT Parser
// Handles parsing, storage, and management of ChatGPT conversations

class ChatGPTData {
    constructor() {
        this.conversations = [];
        this.currentSort = 'newestCreated'; // Default sort option
        this.currentConversationId = null;
        this.storageKey = 'chatgpt_parser_data';

        // Initialize IndexedDB if supported, otherwise use localStorage only
        this.idbStorage = IndexedDBStorage.isSupported()
            ? new IndexedDBStorage()
            : null;

        // Storage mode: 'indexeddb' or 'localstorage'
        this.storageMode = this.idbStorage ? 'indexeddb' : 'localstorage';
    }

    // Parse ChatGPT JSON export
    parseJSONExport(jsonData) {
        const conversations = [];

        // Handle different export formats
        if (Array.isArray(jsonData)) {
            // Format: Array of conversations
            jsonData.forEach(conv => {
                conversations.push(this.parseSingleConversation(conv));
            });
        } else if (jsonData.conversations && Array.isArray(jsonData.conversations)) {
            // Format: { conversations: [...] }
            jsonData.conversations.forEach(conv => {
                conversations.push(this.parseSingleConversation(conv));
            });
        } else if (jsonData.mapping) {
            // Format: ChatGPT data export format with mapping
            conversations.push(this.parseMappingFormat(jsonData));
        }

        return conversations.filter(c => c !== null);
    }

    parseSingleConversation(conv) {
        try {
            // Detect format and extract metadata
            const isDeepSeek = conv.inserted_at && conv.updated_at;
            const isClaude = conv.chat_messages && Array.isArray(conv.chat_messages);
            const title = conv.title || conv.name || 'New Chat'; // Claude uses 'name' field

            let createTime, updateTime;
            if (isDeepSeek || isClaude) {
                // Parse DeepSeek/Claude ISO 8601 timestamps
                createTime = this.parseISO8601(conv.inserted_at || conv.created_at);
                updateTime = this.parseISO8601(conv.updated_at);
            } else {
                // ChatGPT format (Unix timestamps)
                createTime = conv.create_time || conv.timestamp || Date.now() / 1000;
                updateTime = conv.update_time || conv.timestamp || Date.now() / 1000;
            }

            // Parse messages based on format
            let pairs = [];
            if (isClaude) {
                // Claude format with chat_messages array
                pairs = this.parseClaudeMessages(conv.chat_messages);
            } else if (conv.mapping) {
                // Detect if it's DeepSeek or ChatGPT mapping format
                if (isDeepSeek) {
                    pairs = this.parseDeepSeekMapping(conv.mapping);
                } else {
                    // ChatGPT data export format - use current_node for traversal
                    pairs = this.parseMappingMessages(conv.mapping, conv.current_node);
                }
            } else if (conv.messages && Array.isArray(conv.messages)) {
                // Simple format - convert to pairs
                pairs = this.convertMessagesToPairs(conv.messages);
            } else if (conv.conversation && conv.conversation.messages) {
                pairs = this.convertMessagesToPairs(conv.conversation.messages);
            }

            // Calculate actual timestamps from pairs if not provided
            let actualCreateTime = createTime;
            let actualUpdateTime = updateTime;

            if (pairs.length > 0) {
                // Get first message timestamp as create time
                const firstMessage = pairs[0].question;
                if (firstMessage && firstMessage.timestamp) {
                    actualCreateTime = Math.min(actualCreateTime, firstMessage.timestamp);
                }

                // Get last answer timestamp as update time
                const lastPair = pairs[pairs.length - 1];
                if (lastPair && lastPair.answers.length > 0) {
                    const lastAnswer = lastPair.answers[lastPair.answers.length - 1];
                    if (lastAnswer && lastAnswer.timestamp) {
                        actualUpdateTime = Math.max(actualUpdateTime, lastAnswer.timestamp);
                    }
                }
            }

            return {
                id: conv.conversation_id || conv.id || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: title,
                createTime: actualCreateTime,
                updateTime: actualUpdateTime,
                pairs: pairs,
                starred: false,
                source: isClaude ? 'claude' : (isDeepSeek ? 'deepseek' : 'chatgpt') // Track source format
            };
        } catch (error) {
            console.error('Error parsing conversation:', error);
            return null;
        }
    }

    // Helper to convert flat message list to pairs
    convertMessagesToPairs(messages) {
        const pairs = [];
        let currentPair = null;
        let pairIndex = 1;

        messages.forEach((msg, idx) => {
            const role = msg.role || msg.author;
            const isUser = role === 'user';
            const isAssistant = role === 'assistant' || role === 'tool';

            if (isUser) {
                // Start a new pair
                currentPair = {
                    id: msg.id || `pair_${idx}`,
                    question: {
                        id: msg.id,
                        role: 'user',
                        content: msg.content || msg.text || '',
                        timestamp: msg.create_time || msg.timestamp || Date.now() / 1000,
                        // Preserve all non-empty metadata
                        metadata: msg.metadata || {},
                        author: msg.author || {},
                        recipient: msg.recipient || null,
                        channel: msg.channel || null,
                        status: msg.status || null,
                        weight: msg.weight || null,
                        end_turn: msg.end_turn || null
                    },
                    answers: [],
                    index: pairIndex++,
                    starred: false
                };
                pairs.push(currentPair);
            } else if (isAssistant && currentPair) {
                // Add answer to current pair
                currentPair.answers.push({
                    id: msg.id,
                    role: 'assistant',
                    content: msg.content || msg.text || '',
                    timestamp: msg.create_time || msg.timestamp || Date.now() / 1000,
                    model: msg.model || msg.model_slug || msg.metadata?.model_slug || 'GPT',
                    // Preserve all non-empty metadata
                    metadata: msg.metadata || {},
                    author: msg.author || {},
                    recipient: msg.recipient || null,
                    channel: msg.channel || null,
                    status: msg.status || null,
                    weight: msg.weight || null,
                    end_turn: msg.end_turn || null
                });
            }
        });

        return pairs;
    }

    parseMappingFormat(data) {
        const mapping = data.mapping || {};
        let currentNode = data.current_node || null;
        let title = data.title || 'New Chat';

        // Use current_node for traversal
        let pairs = [];
        if (currentNode && mapping[currentNode]) {
            pairs = this.traverseConversation(mapping, currentNode, 1);
        }

        return {
            id: data.conversation_id || data.id || `conv_${Date.now()}`,
            title: title,
            createTime: data.create_time || Date.now() / 1000,
            updateTime: data.update_time || Date.now() / 1000,
            pairs: pairs, // Changed from messages to pairs
            starred: false
        };
    }

    parseMappingMessages(mapping, currentNode) {
        if (!currentNode || !mapping[currentNode]) {
            return [];
        }
        return this.traverseConversation(mapping, currentNode, 1);
    }

    traverseConversation(mapping, nodeId, startIndex) {
        const pairs = [];
        let pairIndex = startIndex;
        let currentNode = nodeId;

        // Traverse backwards through parent links (like ChatGPT's HTML export)
        const tempMessages = [];
        while (currentNode && mapping[currentNode]) {
            const node = mapping[currentNode];
            const message = node.message;

            if (message && message.content && message.content.parts) {
                const parts = message.content.parts;
                let content = '';

                // Filter and join text parts only
                for (const part of parts) {
                    if (typeof part === 'string' && part.trim().length > 0) {
                        content += part;
                    }
                    // Ignore non-text parts (assets, transcripts, etc.)
                }

                // Skip empty content
                if (!content.trim()) {
                    currentNode = node.parent;
                    continue;
                }

                // Filter out system messages (unless it's a user system message)
                const role = message.author?.role;
                const isSystem = role === 'system';
                const isUserSystemMessage = message.metadata?.is_user_system_message;

                if (isSystem && !isUserSystemMessage) {
                    currentNode = node.parent;
                    continue;
                }

                // Build complete message object with all metadata
                const msgObj = {
                    id: message.id,
                    role: role,
                    content: content,
                    timestamp: message.create_time || Date.now() / 1000,
                    // Preserve all non-empty metadata
                    metadata: message.metadata || {},
                    author: message.author || {},
                    recipient: message.recipient || null,
                    channel: message.channel || null,
                    status: message.status || null,
                    weight: message.weight || null,
                    end_turn: message.end_turn || null
                };

                // Add model name for assistant messages
                if (role === 'assistant' || role === 'tool') {
                    msgObj.model = message.metadata?.model_slug ||
                                  message.metadata?.default_model_slug ||
                                  'GPT';
                }

                tempMessages.push(msgObj);
            }

            // Move to parent node (traverse backwards)
            currentNode = node.parent;
        }

        // Reverse to get correct order
        tempMessages.reverse();

        // Group into pairs: each user question + following assistant responses
        let currentPair = null;
        tempMessages.forEach((msg, idx) => {
            const isUser = msg.role === 'user';
            const isAssistant = msg.role === 'assistant' || msg.role === 'tool';

            if (isUser) {
                // Start a new pair
                currentPair = {
                    id: msg.id,
                    question: msg,
                    answers: [],
                    index: pairIndex++,
                    starred: false
                };
                pairs.push(currentPair);
            } else if (isAssistant && currentPair) {
                // Add answer to current pair
                currentPair.answers.push(msg);
            }
        });

        return pairs;
    }

    // Parse DeepSeek mapping format with fragments
    parseDeepSeekMapping(mapping) {
        const pairs = [];
        let pairIndex = 1;
        let currentPair = null;

        // Find all message nodes in the mapping
        const messageNodes = Object.values(mapping).filter(node => node.message && node.message.fragments);

        // Sort by inserted_at to maintain chronological order
        messageNodes.sort((a, b) => {
            const timeA = new Date(a.message.inserted_at).getTime();
            const timeB = new Date(b.message.inserted_at).getTime();
            return timeA - timeB;
        });

        messageNodes.forEach((node) => {
            const msg = node.message;
            const fragments = msg.fragments || [];
            const model = msg.model || 'DeepSeek';

            // Process fragments by type
            let userContent = '';
            let thinkContent = '';
            let responseContent = '';
            let timestamp = this.parseISO8601(msg.inserted_at);

            fragments.forEach(frag => {
                if (frag.type === 'REQUEST') {
                    userContent += frag.content;
                } else if (frag.type === 'THINK') {
                    thinkContent += frag.content;
                } else if (frag.type === 'RESPONSE') {
                    responseContent += frag.content;
                }
            });

            // Create user message
            if (userContent) {
                currentPair = {
                    id: node.id,
                    question: {
                        id: node.id,
                        role: 'user',
                        content: userContent,
                        timestamp: timestamp,
                        metadata: msg,
                        model: model
                    },
                    answers: [],
                    index: pairIndex++,
                    starred: false
                };
                pairs.push(currentPair);
            }

            // Create assistant response (with optional thinking)
            if (responseContent || thinkContent) {
                if (currentPair) {
                    const answer = {
                        id: node.id + '_response',
                        role: 'assistant',
                        content: responseContent,
                        timestamp: timestamp,
                        model: this.formatModelName(model),
                        thinking: thinkContent || null, // Store thinking separately
                        metadata: msg
                    };
                    currentPair.answers.push(answer);
                }
            }
        });

        return pairs;
    }

    // Parse Claude chat_messages format with content arrays
    parseClaudeMessages(chatMessages) {
        const pairs = [];
        let pairIndex = 1;
        let currentPair = null;

        chatMessages.forEach((msg, idx) => {
            const role = msg.role || msg.sender;
            const isUser = role === 'user' || role === 'human'; // Claude uses 'human'
            const isAssistant = role === 'assistant';

            // Extract text from content array, filtering out tool_use blocks
            let textContent = '';
            let hasToolUse = false;
            const artifacts = []; // Store artifacts separately

            if (msg.content && Array.isArray(msg.content)) {
                msg.content.forEach(block => {
                    if (block.type === 'text') {
                        textContent += block.text || '';
                    } else if (block.type === 'tool_use') {
                        hasToolUse = true;
                        // Check if this is an artifact
                        if (block.name === 'artifacts' && block.input && block.input.content) {
                            artifacts.push({
                                id: block.input.id,
                                type: block.input.type,
                                title: block.input.title || 'Artifact',
                                content: block.input.content
                            });
                        }
                    }
                    // Ignore tool_result, token_budget, and other non-text blocks
                });
            } else if (typeof msg.content === 'string') {
                textContent = msg.content;
            }

            // Skip messages that have neither text content nor tool_use
            if (!textContent.trim() && !hasToolUse) {
                return;
            }

            const timestamp = msg.created_at ? this.parseISO8601(msg.created_at) : Date.now() / 1000;

            if (isUser) {
                // Start a new pair
                currentPair = {
                    id: msg.uuid || `msg_${pairIndex}`,
                    question: {
                        id: msg.uuid,
                        role: 'user',
                        content: textContent,
                        timestamp: timestamp,
                        metadata: msg
                    },
                    answers: [],
                    index: pairIndex++,
                    starred: false
                };
                pairs.push(currentPair);
            } else if (isAssistant && currentPair) {
                // Add answer to current pair
                // Even if there's no text content, we create an answer to maintain the pair structure
                const answer = {
                    id: msg.uuid + '_response',
                    role: 'assistant',
                    content: textContent || '[Tool use only - no text response]',
                    timestamp: timestamp,
                    model: 'Claude', // Display Claude as model
                    metadata: msg,
                    toolUseOnly: hasToolUse && !textContent.trim(),
                    artifacts: artifacts.length > 0 ? artifacts : undefined // Store artifacts if present
                };
                currentPair.answers.push(answer);
            }
        });

        return pairs;
    }

    // Format model name for display
    formatModelName(model) {
        if (!model) return 'AI';

        // If it's already 'Claude', return as-is
        if (model === 'Claude') return 'Claude';

        const modelLower = model.toLowerCase();

        if (modelLower.includes('deepseek')) {
            if (modelLower.includes('reasoner')) {
                return 'DeepSeek Reasoner';
            }
            return 'DeepSeek Chat';
        }

        if (modelLower.includes('gpt')) {
            return model; // Return GPT model name as-is (e.g., "GPT-4", "gpt-4o")
        }

        if (modelLower.includes('claude')) {
            return 'Claude';
        }

        if (modelLower.includes('gemini')) {
            return 'Gemini';
        }

        // Capitalize first letter
        return model.charAt(0).toUpperCase() + model.slice(1);
    }

    // Parse ISO 8601 timestamp to Unix timestamp
    parseISO8601(isoString) {
        if (!isoString) return Date.now() / 1000;

        try {
            const date = new Date(isoString);
            return date.getTime() / 1000;
        } catch (error) {
            console.error('Error parsing ISO 8601 timestamp:', isoString, error);
            return Date.now() / 1000;
        }
    }

    // Parse HTML export
    parseHTMLExport(htmlContent) {
        const conversations = [];

        // Try to extract jsonData from script tag (ChatGPT's HTML export format)
        const startIndex = htmlContent.indexOf('var jsonData = ');
        if (startIndex !== -1) {
            // Find the start of the array
            const arrayStart = htmlContent.indexOf('[', startIndex);
            if (arrayStart !== -1) {
                // Count brackets to find the matching end bracket
                let bracketCount = 0;
                let inString = false;
                let escapeNext = false;
                let endIndex = -1;

                for (let i = arrayStart; i < htmlContent.length; i++) {
                    const char = htmlContent[i];

                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }

                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }

                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (char === '[') {
                            bracketCount++;
                        } else if (char === ']') {
                            bracketCount--;
                            if (bracketCount === 0) {
                                endIndex = i;
                                break;
                            }
                        }
                    }
                }

                if (endIndex !== -1) {
                    const jsonStr = htmlContent.substring(arrayStart, endIndex + 1);
                    try {
                        const jsonData = JSON.parse(jsonStr);
                        return this.parseJSONExport(jsonData);
                    } catch (error) {
                        console.error('Error parsing embedded JSON in HTML:', error);
                        console.log('Failed JSON string length:', jsonStr.length);
                    }
                }
            }
        }

        // Fallback to DOM-based parsing
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Try to find conversation containers
        const convElements = doc.querySelectorAll('.conversation');

        if (convElements.length > 0) {
            // Multiple conversations
            convElements.forEach((convEl, idx) => {
                const conversation = this.parseHTMLConversation(convEl, idx);
                if (conversation) {
                    conversations.push(conversation);
                }
            });
        } else {
            // Single conversation
            const conversation = this.parseHTMLConversation(doc, 0);
            if (conversation) {
                conversations.push(conversation);
            }
        }

        return conversations;
    }

    parseHTMLConversation(doc, index) {
        try {
            // Extract title
            const titleEl = doc.querySelector('h1, .conversation-title, title');
            const title = titleEl ? titleEl.textContent.trim() : `Chat ${index + 1}`;

            // Extract messages
            const messages = [];
            const messageEls = doc.querySelectorAll('.text-base, [data-message-id], .message, .conversation-turn');

            let msgIndex = 1;
            messageEls.forEach(msgEl => {
                // Try to determine role
                const isUser = msgEl.classList.contains('user') ||
                              msgEl.querySelector('[data-author-role="user"]') ||
                              msgEl.textContent.includes('You');

                const role = isUser ? 'user' : 'assistant';

                // Extract content
                const contentEl = msgEl.querySelector('.markdown, .prose, .message-content, [data-message-content]') || msgEl;
                const content = contentEl.textContent.trim();

                if (content) {
                    const msgObj = {
                        id: `msg_${msgIndex}`,
                        role: role,
                        content: content,
                        timestamp: Date.now() / 1000,
                        // Basic metadata structure
                        metadata: {},
                        author: { role: role },
                        recipient: null,
                        channel: null,
                        status: null,
                        weight: null,
                        end_turn: null
                    };

                    // Add model name for assistant messages
                    if (role === 'assistant') {
                        msgObj.model = 'GPT'; // Default for HTML exports
                    }

                    messages.push(msgObj);
                    msgIndex++;
                }
            });

            if (messages.length === 0) {
                return null;
            }

            // Convert messages to pairs
            const pairs = this.convertMessagesToPairs(messages);

            return {
                id: `conv_${Date.now()}_${index}`,
                title: title,
                createTime: Date.now() / 1000,
                updateTime: Date.now() / 1000,
                pairs: pairs,
                starred: false
            };
        } catch (error) {
            console.error('Error parsing HTML conversation:', error);
            return null;
        }
    }

    // Storage methods
    async saveToStorage() {
        const data = {
            conversations: this.conversations,
            currentConversationId: this.currentConversationId,
            currentSort: this.currentSort
        };

        // Try IndexedDB first if available
        if (this.storageMode === 'indexeddb') {
            try {
                // Save conversations to IndexedDB
                await this.idbStorage.saveConversations(this.conversations);

                // Save settings
                await this.idbStorage.saveSetting('currentConversationId', this.currentConversationId);
                await this.idbStorage.saveSetting('currentSort', this.currentSort);

                console.log('Data saved to IndexedDB');
                return;
            } catch (error) {
                console.error('IndexedDB save failed, falling back to localStorage:', error);
                // Fall through to localStorage fallback
            }
        }

        // localStorage fallback (or if IndexedDB is not available)
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            console.log('Data saved to localStorage');
        } catch (error) {
            console.error('localStorage save failed:', error);
            // If localStorage is full, try to clear and save again
            if (error.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded. Consider clearing old data or using a browser with more storage.');
            }
        }
    }

    async loadFromStorage() {
        // Try IndexedDB first if available
        if (this.storageMode === 'indexeddb') {
            try {
                // Load conversations from IndexedDB
                const conversations = await this.idbStorage.loadConversations();
                if (conversations && conversations.length > 0) {
                    this.conversations = conversations;

                    // Load settings
                    this.currentConversationId = await this.idbStorage.loadSetting('currentConversationId');
                    this.currentSort = await this.idbStorage.loadSetting('currentSort') || 'newestCreated';

                    console.log('Data loaded from IndexedDB');
                    return true;
                } else {
                    console.log('No data in IndexedDB, trying localStorage');
                }
            } catch (error) {
                console.error('IndexedDB load failed, trying localStorage:', error);
                // Fall through to localStorage fallback
            }
        }

        // localStorage fallback
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.conversations = data.conversations || [];
                this.currentConversationId = data.currentConversationId;
                this.currentSort = data.currentSort || 'newestCreated';
                console.log('Data loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
        return false;
    }

    async clearStorage() {
        // Clear IndexedDB if available
        if (this.storageMode === 'indexeddb') {
            try {
                await this.idbStorage.clear();
                console.log('IndexedDB cleared');
            } catch (error) {
                console.error('Error clearing IndexedDB:', error);
            }
        }

        // Clear localStorage
        localStorage.removeItem(this.storageKey);
        this.conversations = [];
        this.currentConversationId = null;
        console.log('Storage cleared');
    }

    // Conversation management
    async addConversations(newConversations) {
        // Merge with existing, avoiding duplicates
        const existingIds = new Set(this.conversations.map(c => c.id));

        newConversations.forEach(conv => {
            if (!existingIds.has(conv.id)) {
                this.conversations.push(conv);
                existingIds.add(conv.id);
            }
        });

        // Sort by update time, newest first
        this.conversations.sort((a, b) => b.updateTime - a.updateTime);

        await this.saveToStorage();
    }

    getConversation(id) {
        return this.conversations.find(c => c.id === id);
    }

    getCurrentConversation() {
        if (this.currentConversationId) {
            return this.getConversation(this.currentConversationId);
        }
        return null;
    }

    async updateConversationTitle(id, newTitle) {
        const conv = this.getConversation(id);
        if (conv) {
            conv.title = newTitle;
            conv.updateTime = Date.now() / 1000;
            await this.saveToStorage();
            return true;
        }
        return false;
    }

    async deleteConversation(id) {
        const index = this.conversations.findIndex(c => c.id === id);
        if (index !== -1) {
            this.conversations.splice(index, 1);
            if (this.currentConversationId === id) {
                this.currentConversationId = null;
            }
            await this.saveToStorage();
            return true;
        }
        return false;
    }

    // Message management (deprecated - now using pairs)
    deleteMessage(conversationId, messageId) {
        // This method is kept for backward compatibility but now calls deletePair
        console.warn('deleteMessage is deprecated, use deletePair instead');
        return this.deletePair(conversationId, messageId);
    }

    async toggleStarConversation(id) {
        const conv = this.getConversation(id);
        if (conv) {
            conv.starred = !conv.starred;
            await this.saveToStorage();
            return conv.starred;
        }
        return false;
    }

    toggleStarMessage(conversationId, messageId) {
        // This method is kept for backward compatibility but now calls toggleStarPair
        console.warn('toggleStarMessage is deprecated, use toggleStarPair instead');
        return this.toggleStarPair(conversationId, messageId);
    }

    // Search methods
    searchConversations(query) {
        if (!query || query.trim() === '') {
            return this.conversations;
        }

        const lowerQuery = query.toLowerCase();

        return this.conversations.filter(conv => {
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

    searchInConversation(conversationId, query) {
        const conv = this.getConversation(conversationId);
        if (!conv || !query || query.trim() === '') {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        const results = [];

        conv.pairs.forEach(pair => {
            const questionMatch = pair.question.content.toLowerCase().includes(lowerQuery);
            const answerMatch = pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery));

            if (questionMatch || answerMatch) {
                results.push(pair);
            }
        });

        return results;
    }

    getStarredConversations() {
        return this.conversations.filter(c => c.starred);
    }

    getStarredPairs(conversationId = null) {
        if (conversationId) {
            const conv = this.getConversation(conversationId);
            return conv ? conv.pairs.filter(p => p.starred) : [];
        }

        // Get all starred pairs across all conversations
        const results = [];
        this.conversations.forEach(conv => {
            conv.pairs.filter(p => p.starred).forEach(pair => {
                results.push({
                    ...pair,
                    conversationId: conv.id,
                    conversationTitle: conv.title
                });
            });
        });
        return results;
    }

    // Pair management
    async deletePair(conversationId, pairId) {
        const conv = this.getConversation(conversationId);
        if (conv) {
            const index = conv.pairs.findIndex(p => p.id === pairId);
            if (index !== -1) {
                conv.pairs.splice(index, 1);
                // Renumber pairs
                conv.pairs.forEach((p, idx) => {
                    p.index = idx + 1;
                });

                // Update timestamps after deletion
                this.updateConversationTimestamps(conv);

                await this.saveToStorage();
                return true;
            }
        }
        return false;
    }

    // Update conversation timestamps based on current pairs
    updateConversationTimestamps(conv) {
        if (conv.pairs.length > 0) {
            // Get first message timestamp as create time
            const firstMessage = conv.pairs[0].question;
            if (firstMessage && firstMessage.timestamp) {
                conv.createTime = Math.min(conv.createTime, firstMessage.timestamp);
            }

            // Get last answer timestamp as update time
            const lastPair = conv.pairs[conv.pairs.length - 1];
            if (lastPair && lastPair.answers.length > 0) {
                const lastAnswer = lastPair.answers[lastPair.answers.length - 1];
                if (lastAnswer && lastAnswer.timestamp) {
                    conv.updateTime = Math.max(conv.updateTime, lastAnswer.timestamp);
                }
            }
        }
    }

    async toggleStarPair(conversationId, pairId) {
        const conv = this.getConversation(conversationId);
        if (conv) {
            const pair = conv.pairs.find(p => p.id === pairId);
            if (pair) {
                pair.starred = !pair.starred;
                await this.saveToStorage();
                return pair.starred;
            }
        }
        return false;
    }

    // Export methods
    exportProject() {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            conversations: this.conversations,
            metadata: {
                totalConversations: this.conversations.length,
                totalPairs: this.conversations.reduce((sum, conv) => sum + conv.pairs.length, 0)
            }
        };
    }

    importProject(projectData) {
        if (projectData && projectData.conversations) {
            this.addConversations(projectData.conversations);
            return true;
        }
        return false;
    }
}

// Create global instance
const chatData = new ChatGPTData();
