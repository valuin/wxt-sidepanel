import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from '#imports';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';

// Define message types
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

interface ChatbotUIProps {
  chatId: string;
}

const ChatbotUI: React.FC<ChatbotUIProps> = ({ chatId }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Define storage item for chat messages dynamically based on chatId, memoized
  const chatMessagesStorage = useMemo(() => {
    return storage.defineItem<Message[]>(`local:chatMessages_${chatId}`, {
      fallback: [],
    });
  }, [chatId]);

  // Load messages from storage on component mount or when chatId changes
  useEffect(() => {
    const loadMessages = async () => {
      const chatHistory = await chatMessagesStorage.getValue();
      setMessages(chatHistory);
    };
    loadMessages();
  }, [chatId]);

  // Load messages from storage on component mount or when chatId changes
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const chatHistory = await chatMessagesStorage.getValue();
        setMessages(chatHistory);
      } catch (error) {
      }
    };
    loadMessages();
  }, [chatId, chatMessagesStorage]);

  // Save messages to storage whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      console.log(`[ChatbotUI - ${chatId}] Messages state changed. Attempting to save:`, messages);
      try {
        await chatMessagesStorage.setValue(messages);
        console.log(`[ChatbotUI - ${chatId}] Successfully saved messages.`);
      } catch (error) {
        console.error(`[ChatbotUI - ${chatId}] Error saving messages:`, error);
      }
    };
    // Only save if messages array has actually changed content, not just reference
    // This check prevents unnecessary saves on initial load if fallback is empty
    if (JSON.stringify(messages) !== JSON.stringify(chatMessagesStorage.fallback)) {
        saveMessages();
    }
  }, [messages, chatMessagesStorage, chatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim()) {
      const newUserMessage: Message = {
        id: Date.now().toString(),
        text: input.trim(),
        sender: 'user',
        timestamp: Date.now(),
      };
      console.log(`[ChatbotUI - ${chatId}] User sending message:`, newUserMessage);
      setMessages((prevMessages) => [...prevMessages, newUserMessage]);
      setInput('');

      // Placeholder for AI response
      setTimeout(() => {
        const newAiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `AI response to: "${newUserMessage.text}"`,
          sender: 'ai',
          timestamp: Date.now() + 1,
        };
        console.log(`[ChatbotUI - ${chatId}] AI responding with:`, newAiMessage);
        setMessages((prevMessages) => [...prevMessages, newAiMessage]);
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[70%] p-3 rounded-lg',
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {message.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-4 flex items-center gap-2">
        <Textarea
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none"
          rows={1}
        />
        <Button onClick={handleSendMessage} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatbotUI;