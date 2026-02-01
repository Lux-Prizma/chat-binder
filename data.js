// Data Module for ChatGPT Parser
// Handles parsing, storage, and management of ChatGPT conversations

// Format type constants
const FORMAT_TYPES = {
    APP_EXPORT: 'app_export',           // App's own export
    CLAUDE: 'claude',                   // Claude export
    DEEPSEEK: 'deepseek',               // DeepSeek export
    CHATGPT_MAPPING: 'chatgpt_mapping', // ChatGPT data export
    SIMPLE: 'simple',                   // Simple message array
    WRAPPED_SIMPLE: 'wrapped_simple'    // Nested simple format
};

class ChatGPTData {
    constructor() {
        this.conversations = [];
        this.folders = []; // Custom folders
        this.currentSort = 'newestCreated'; // Default sort option
        this.currentConversationId = null;
        this.storageKey = 'chatgpt_parser_data';

        // Initialize IndexedDB if supported, otherwise use localStorage only
        this.idbStorage = IndexedDBStorage.isSupported()
            ? new IndexedDBStorage()
            : null;

        // Storage mode: 'indexeddb' or 'localstorage'
        this.storageMode = this.idbStorage ? 'indexeddb' : 'localstorage';

        // Initialize with one default folder on first use
        this.initializeDefaultFolder();
    }

    // Initialize default folder if no folders exist
    initializeDefaultFolder() {
        if (this.folders.length === 0) {
            this.folders.push({
                id: 'folder_default',
                name: 'My Folder',
                color: '#3b82f6', // Blue
                order: 0
            });
        }
    }

    // =========================================================================
    // FORMAT VALIDATOR FUNCTIONS
    // =========================================================================

    /**
     * Checks if conversation is in app's own export format
     * App export has pre-parsed pairs array
     */
    isAppExportFormat(conv) {
        return conv.pairs && Array.isArray(conv.pairs) && conv.pairs.length > 0;
    }

    /**
     * Checks if conversation is in Claude format
     * Claude uses chat_messages array with ISO 8601 timestamps
     */
    isClaudeFormat(conv) {
        return conv.chat_messages && Array.isArray(conv.chat_messages);
    }

    /**
     * Checks if conversation is in DeepSeek format
     * DeepSeek uses mapping structure with ISO 8601 timestamps
     */
    isDeepSeekFormat(conv) {
        return conv.mapping && (conv.inserted_at || conv.updated_at);
    }

    /**
     * Checks if conversation is in ChatGPT mapping format
     * ChatGPT uses mapping structure with current_node pointer
     */
    isChatGPTMappingFormat(conv) {
        return conv.mapping && conv.current_node;
    }

    /**
     * Checks if conversation is in simple message array format
     * Simple format has messages array at root level
     */
    isSimpleFormat(conv) {
        return conv.messages && Array.isArray(conv.messages);
    }

    /**
     * Checks if conversation is in wrapped simple format
     * Wrapped simple has nested conversation.messages
     */
    isWrappedSimpleFormat(conv) {
        return conv.conversation && conv.conversation.messages;
    }

    // =========================================================================
    // FORMAT DETECTION
    // =========================================================================

    /**
     * Detects the format of a single conversation object
     * @param {Object} conv - Conversation object to detect
     * @returns {string} Format type constant
     * @throws {Error} If format cannot be determined
     */
    detectConversationFormat(conv) {
        // Check most specific formats first (app export)
        if (this.isAppExportFormat(conv)) {
            return FORMAT_TYPES.APP_EXPORT;
        }

        // Check platform-specific formats
        if (this.isClaudeFormat(conv)) {
            return FORMAT_TYPES.CLAUDE;
        }

        if (this.isDeepSeekFormat(conv)) {
            return FORMAT_TYPES.DEEPSEEK;
        }

        if (this.isChatGPTMappingFormat(conv)) {
            return FORMAT_TYPES.CHATGPT_MAPPING;
        }

        if (this.isSimpleFormat(conv)) {
            return FORMAT_TYPES.SIMPLE;
        }

        if (this.isWrappedSimpleFormat(conv)) {
            return FORMAT_TYPES.WRAPPED_SIMPLE;
        }

        // Unknown format - log and throw
        console.warn('Unknown conversation format:', conv);
        throw new Error(`Unable to determine format for conversation: ${conv.title || conv.id || 'unknown'}`);
    }

    // =========================================================================
    // INDIVIDUAL FORMAT PARSERS
    // =========================================================================

    /**
     * Parses app's own export format
     * Pairs are already parsed, just need to return them
     */
    parseAppExport(conv) {
        return {
            pairs: conv.pairs,
            createTime: conv.createTime || Date.now() / 1000,
            updateTime: conv.updateTime || Date.now() / 1000,
            source: conv.source || 'app_export',
            title: conv.title
        };
    }

    /**
     * Parses Claude format
     * Claude uses chat_messages array with ISO 8601 timestamps
     */
    parseClaudeFormat(conv) {
        return {
            pairs: this.parseClaudeMessages(conv.chat_messages),
            createTime: this.parseISO8601(conv.created_at),
            updateTime: this.parseISO8601(conv.updated_at),
            source: 'claude',
            title: conv.name || conv.title
        };
    }

    /**
     * Parses DeepSeek format
     * DeepSeek uses mapping with fragments
     */
    parseDeepSeekFormat(conv) {
        return {
            pairs: this.parseDeepSeekMapping(conv.mapping),
            createTime: this.parseISO8601(conv.inserted_at),
            updateTime: this.parseISO8601(conv.updated_at),
            source: 'deepseek',
            title: conv.title
        };
    }

    /**
     * Parses ChatGPT mapping format
     * ChatGPT uses mapping with current_node for traversal
     */
    parseChatGPTMappingFormat(conv) {
        return {
            pairs: this.parseMappingMessages(conv.mapping, conv.current_node),
            createTime: conv.create_time || Date.now() / 1000,
            updateTime: conv.update_time || Date.now() / 1000,
            source: 'chatgpt',
            title: conv.title
        };
    }

    /**
     * Parses simple message array format
     * Simple format has flat messages array
     */
    parseSimpleFormat(conv) {
        return {
            pairs: this.convertMessagesToPairs(conv.messages),
            createTime: conv.create_time || Date.now() / 1000,
            updateTime: conv.update_time || Date.now() / 1000,
            source: 'chatgpt',
            title: conv.title
        };
    }

    /**
     * Parses wrapped simple format
     * Has nested conversation.messages structure
     */
    parseWrappedSimpleFormat(conv) {
        return this.parseSimpleFormat(conv.conversation);
    }

    /**
     * Strategy map: format type → parser function
     */
    parseByFormat = {
        [FORMAT_TYPES.APP_EXPORT]: (conv) => this.parseAppExport(conv),
        [FORMAT_TYPES.CLAUDE]: (conv) => this.parseClaudeFormat(conv),
        [FORMAT_TYPES.DEEPSEEK]: (conv) => this.parseDeepSeekFormat(conv),
        [FORMAT_TYPES.CHATGPT_MAPPING]: (conv) => this.parseChatGPTMappingFormat(conv),
        [FORMAT_TYPES.SIMPLE]: (conv) => this.parseSimpleFormat(conv),
        [FORMAT_TYPES.WRAPPED_SIMPLE]: (conv) => this.parseWrappedSimpleFormat(conv)
    };

    // =========================================================================
    // MAIN PARSING FUNCTIONS
    // =========================================================================

    /**
     * Normalize timestamps from pairs if available
     */
    normalizeTimestamps(pairs, createTime, updateTime) {
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
            createTime: actualCreateTime,
            updateTime: actualUpdateTime
        };
    }

    // Parse ChatGPT JSON export
    parseJSONExport(jsonData) {
        const conversations = [];
        const warnings = [];

        // Handle different export formats
        let conversationList = [];
        if (Array.isArray(jsonData)) {
            // Format: Array of conversations
            conversationList = jsonData;
        } else if (jsonData.conversations && Array.isArray(jsonData.conversations)) {
            // Format: { conversations: [...] }
            conversationList = jsonData.conversations;
        } else if (jsonData.mapping) {
            // Format: ChatGPT data export format with mapping
            conversationList = [jsonData];
        } else {
            warnings.push('Unknown JSON structure');
            return { conversations: [], warnings };
        }

        conversationList.forEach((conv, index) => {
            try {
                const parsed = this.parseSingleConversation(conv);
                if (parsed) {
                    conversations.push(parsed);
                } else {
                    warnings.push(`Conversation at index ${index} could not be parsed`);
                }
            } catch (error) {
                warnings.push(`Conversation at index ${index}: ${error.message}`);
            }
        });

        return {
            conversations: conversations.filter(c => c !== null),
            warnings
        };
    }

    parseSingleConversation(conv) {
        try {
            // Step 1: Detect format
            const format = this.detectConversationFormat(conv);

            // Step 2: Parse based on format using strategy map
            const parsed = this.parseByFormat[format](conv);

            // Step 3: Normalize timestamps from pairs if available
            const normalizedTimestamps = this.normalizeTimestamps(
                parsed.pairs,
                parsed.createTime,
                parsed.updateTime
            );

            // Step 4: Return standardized conversation object
            return {
                id: conv.conversation_id || conv.id || conv.uuid || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: parsed.title || 'New Chat',
                createTime: normalizedTimestamps.createTime,
                updateTime: normalizedTimestamps.updateTime,
                pairs: parsed.pairs,
                starred: false,
                source: parsed.source,
                folderId: conv.folderId || null // Preserve folder assignment
            };
        } catch (error) {
            console.error('Error parsing conversation:', error, 'Conversation:', conv);
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
            let hasAttachments = false; // Track file attachments
            const artifacts = []; // Store artifacts separately
            const attachmentMarkers = []; // Store file info for display

            if (msg.content && Array.isArray(msg.content)) {
                msg.content.forEach(block => {
                    if (block.type === 'text') {
                        textContent += block.text || '';
                    } else if (block.type === 'tool_use') {
                        hasToolUse = true;

                        // Track if we've already captured an artifact from this block to avoid duplicates
                        let artifactCaptured = false;

                        // Priority 1: Check display_content.json_block (new file creation format)
                        if (block.display_content && block.display_content.type === 'json_block' && block.display_content.json_block) {
                            console.log('[Artifact] Found json_block format for', block.name);
                            try {
                                const jsonData = JSON.parse(block.display_content.json_block);
                                if (jsonData.code || jsonData.content) {
                                    const filename = jsonData.filename?.split('/').pop() || block.name || 'Artifact';
                                    artifacts.push({
                                        id: filename,
                                        type: jsonData.language || 'text',
                                        title: filename,
                                        content: jsonData.code || jsonData.content || ''
                                    });
                                    artifactCaptured = true;
                                    console.log('[Artifact] ✓ Captured from json_block:', filename);
                                }
                            } catch (error) {
                                console.warn('[Artifact] ✗ Failed to parse json_block:', error);
                            }
                        }

                        // Priority 2: Check display_content.code_block (another file creation format)
                        if (!artifactCaptured && block.display_content && block.display_content.type === 'code_block' && block.display_content.code) {
                            const filename = block.display_content.filename?.split('/').pop() ||
                                              (block.input && block.input.path?.split('/').pop()) ||
                                              block.name || 'Artifact';
                            console.log('[Artifact] Found code_block format for', block.name, '->', filename);
                            artifacts.push({
                                id: filename,
                                type: block.display_content.language || 'text',
                                title: filename,
                                content: block.display_content.code
                            });
                            artifactCaptured = true;
                            console.log('[Artifact] ✓ Captured from code_block:', filename, 'length:', block.display_content.code.length);
                        }

                        // Priority 3: Check create_file with input.file_text (fallback when no display_content)
                        if (!artifactCaptured && block.name === 'create_file' && block.input && block.input.file_text) {
                            const filePath = block.input.path || '';
                            const fileName = filePath.split('/').pop() || 'Artifact';
                            const fileExt = fileName.split('.').pop() || 'txt';

                            console.log('[Artifact] Found file_text format for', block.name, '->', fileName);
                            artifacts.push({
                                id: fileName,
                                type: fileExt,
                                title: fileName,
                                content: block.input.file_text
                            });
                            artifactCaptured = true;
                            console.log('[Artifact] ✓ Captured from file_text:', fileName, 'length:', block.input.file_text.length);
                        }

                        // Priority 4: Old format artifacts (name='artifacts' with input.content)
                        if (block.name === 'artifacts' && block.input && block.input.content) {
                            console.log('[Artifact] Found old format artifacts');
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

            // Check for file attachments
            if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
                hasAttachments = true;
                msg.attachments.forEach(att => {
                    const fileName = att.file_name || att.extracted_content?.substring(0, 30) + '...' || 'file';
                    attachmentMarkers.push(`[file: ${fileName}]`);
                    // Append extracted content if available
                    if (att.extracted_content) {
                        textContent += (textContent ? '\n\n' : '') + att.extracted_content;
                    }
                });
            }

            // Check for files array
            if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
                hasAttachments = true;
                msg.files.forEach(file => {
                    if (file.file_name) {
                        attachmentMarkers.push(`[file: ${file.file_name}]`);
                    }
                });
            }

            // Skip messages that have neither text content, tool_use, nor attachments
            if (!textContent.trim() && !hasToolUse && !hasAttachments) {
                return;
            }

            const timestamp = msg.created_at ? this.parseISO8601(msg.created_at) : Date.now() / 1000;

            if (isUser) {
                // Start a new pair
                // Add attachment markers to content for display
                const displayContent = attachmentMarkers.length > 0
                    ? attachmentMarkers.join(' ') + (textContent ? '\n\n' + textContent : '')
                    : textContent;

                currentPair = {
                    id: msg.uuid || `msg_${pairIndex}`,
                    question: {
                        id: msg.uuid,
                        role: 'user',
                        content: displayContent || '[File upload]',
                        timestamp: timestamp,
                        metadata: msg,
                        hasAttachments: hasAttachments // Store flag for potential future UI use
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
                        const result = this.parseJSONExport(jsonData);
                        return result.conversations;
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
            folders: this.folders,
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
                await this.idbStorage.saveSetting('folders', this.folders);

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

                    // Load folders
                    const folders = await this.idbStorage.loadSetting('folders');
                    if (folders && folders.length > 0) {
                        this.folders = folders;
                    } else {
                        this.initializeDefaultFolder();
                    }

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
                this.folders = data.folders || [];
                this.currentConversationId = data.currentConversationId;
                this.currentSort = data.currentSort || 'newestCreated';

                // Initialize default folder if none exist
                if (this.folders.length === 0) {
                    this.initializeDefaultFolder();
                }

                console.log('Data loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }

        // Initialize default folder if no data loaded
        this.initializeDefaultFolder();
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
    /**
     * Detect duplicate conversations
     * @returns {Object} - { duplicates: [], new: [] }
     */
    detectDuplicates(newConversations) {
        const duplicates = [];
        const newConvs = [];

        newConversations.forEach(newConv => {
            const existing = this.conversations.find(c => c.id === newConv.id);
            if (existing) {
                duplicates.push({
                    id: newConv.id,
                    old: existing,
                    new: newConv
                });
            } else {
                newConvs.push(newConv);
            }
        });

        return { duplicates, new: newConvs };
    }

    /**
     * Add conversations with duplicate handling
     * @param {Array} conversationsToAdd - Array of conversations to add
     * @param {Array} duplicatesToOverwrite - Array of conversation IDs to overwrite (optional)
     */
    async addConversations(conversationsToAdd, duplicatesToOverwrite = []) {
        const overwriteSet = new Set(duplicatesToOverwrite);

        conversationsToAdd.forEach(conv => {
            const existingIndex = this.conversations.findIndex(c => c.id === conv.id);

            if (existingIndex !== -1) {
                // Duplicate exists
                if (overwriteSet.has(conv.id)) {
                    // Overwrite existing
                    this.conversations[existingIndex] = conv;
                }
                // If not in overwriteSet, skip (keep old)
            } else {
                // New conversation, add it
                this.conversations.push(conv);
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

    // =========================================================================
    // FOLDER MANAGEMENT METHODS
    // =========================================================================

    /**
     * Create a new folder
     */
    async createFolder(name, color) {
        const folder = {
            id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            color: color || '#3b82f6',
            order: this.folders.length
        };
        this.folders.push(folder);
        await this.saveToStorage();
        return folder;
    }

    /**
     * Update folder properties
     */
    async updateFolder(folderId, updates) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            Object.assign(folder, updates);
            await this.saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * Delete a folder and move conversations back to "All Conversations"
     */
    async deleteFolder(folderId) {
        const index = this.folders.findIndex(f => f.id === folderId);
        if (index !== -1) {
            // Remove folder
            this.folders.splice(index, 1);

            // Move conversations in this folder back to uncategorized
            this.conversations.forEach(conv => {
                if (conv.folderId === folderId) {
                    conv.folderId = null;
                }
            });

            // Reorder remaining folders
            this.folders.forEach((f, idx) => {
                f.order = idx;
            });

            await this.saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * Reorder folders
     */
    async reorderFolders(folderIds) {
        const reorderedFolders = [];
        folderIds.forEach((id, index) => {
            const folder = this.folders.find(f => f.id === id);
            if (folder) {
                folder.order = index;
                reorderedFolders.push(folder);
            }
        });
        this.folders = reorderedFolders;
        await this.saveToStorage();
    }

    /**
     * Get conversations in a specific folder
     */
    getConversationsInFolder(folderId) {
        if (!folderId) {
            // Return uncategorized conversations
            return this.conversations.filter(conv => !conv.folderId);
        }
        return this.conversations.filter(conv => conv.folderId === folderId);
    }

    /**
     * Get folder by ID
     */
    getFolder(folderId) {
        return this.folders.find(f => f.id === folderId);
    }

    /**
     * Move conversation to a folder
     */
    async moveConversationToFolder(conversationId, folderId) {
        const conv = this.getConversation(conversationId);
        if (conv) {
            conv.folderId = folderId; // null means "All Conversations" (uncategorized)
            await this.saveToStorage();
            return true;
        }
        return false;
    }

    // Export methods
    exportProject() {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            conversations: this.conversations,
            folders: this.folders,
            metadata: {
                totalConversations: this.conversations.length,
                totalPairs: this.conversations.reduce((sum, conv) => sum + conv.pairs.length, 0)
            }
        };
    }

    importProject(projectData) {
        if (projectData && projectData.conversations) {
            this.addConversations(projectData.conversations);
            // Import folders if available
            if (projectData.folders && projectData.folders.length > 0) {
                this.folders = projectData.folders;
            }
            return true;
        }
        return false;
    }
}

// Create global instance
const chatData = new ChatGPTData();
