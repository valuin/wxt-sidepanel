import React, { useEffect, useRef, useMemo, useState } from 'react';
import { storage } from '#imports';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const openai = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '',
});

// Define message types for local storage
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

// Define AIMessage type for AI SDK compatibility
interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system'; // Added 'system' role
  content: string;
}

interface ChatbotUIProps {
  chatId: string;
  systemPrompt: string;
}

const ChatbotUI: React.FC<ChatbotUIProps> = ({ chatId, systemPrompt }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Define storage item for chat messages dynamically based on chatId, memoized
  const chatMessagesStorage = useMemo(() => {
    return storage.defineItem<Message[]>(`local:chatMessages_${chatId}`, {
      fallback: [],
    });
  }, [chatId]);

  // Load messages from storage on component mount or when chatId changes
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const chatHistory = await chatMessagesStorage.getValue();
        const formattedMessages: AIMessage[] = chatHistory.map(msg => ({
          id: msg.id,
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));
        setMessages(formattedMessages);
      } catch (error) {
        console.error(`[ChatbotUI - ${chatId}] Error loading messages from storage:`, error);
      }
    };
    loadMessages();
  }, [chatId, chatMessagesStorage]); // Removed setMessages from dependency array as it's a state setter

  // Save messages to storage whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      const messagesToSave: Message[] = messages.map(msg => ({
        id: msg.id,
        text: msg.content,
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: Date.now(),
      }));
      console.log(`[ChatbotUI - ${chatId}] Messages state changed. Attempting to save:`, messagesToSave);
      try {
        await chatMessagesStorage.setValue(messagesToSave);
        console.log(`[ChatbotUI - ${chatId}] Successfully saved messages.`);
      } catch (error) {
        console.error(`[ChatbotUI - ${chatId}] Error saving messages:`, error);
      }
    };
    if (messages.length > 0) {
        saveMessages();
    }
  }, [messages, chatMessagesStorage, chatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const userMessage: AIMessage = { id: Date.now().toString(), role: 'user', content: input };
    const messagesToSend = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages, userMessage] : [...messages, userMessage];
    setMessages(prevMessages => [...prevMessages, userMessage]); // Update UI immediately with user message
    setInput('');

    try {
      const result = await streamText({
        model: openai.chat('gpt-4o-mini'),
        messages: messagesToSend.map(msg => ({ role: msg.role, content: msg.content })) as any, // Cast to any for now, will refine if needed
      });

      let aiResponseContent = '';
      for await (const chunk of result.textStream) {
        aiResponseContent += chunk;
        setMessages(currentMessages => {
          const lastMessage = currentMessages[currentMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            return currentMessages.map((msg, index) =>
              index === currentMessages.length - 1 ? { ...msg, content: aiResponseContent } : msg
            );
          } else {
            return [...currentMessages, { id: Date.now().toString(), role: 'assistant', content: aiResponseContent }];
          }
        });
      }
    } catch (error) {
      console.error(`[ChatbotUI - ${chatId}] Error during AI stream:`, error);
      setMessages(currentMessages => [
        ...currentMessages,
        { id: Date.now().toString(), role: 'assistant', content: 'Error: Unable to get a response.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col space-y-4">
          {messages.map((message: AIMessage) => {
            const sender = message.role === 'user' ? 'user' : 'ai';
            return (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  sender === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[70%] p-3 rounded-lg',
                    sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-white'
                  )}
                >
                  {message.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-4 flex items-center gap-2">
        <Textarea
          placeholder="Type your message..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none"
          rows={1}
        />
        <Button onClick={handleSubmit as any} disabled={!input.trim() || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatbotUI;