import React, { createContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinGame: (gameId: number) => void;
  leaveGame: (gameId: number) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  connected: false,
  joinGame: () => {},
  leaveGame: () => {}
});

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No auth token found, WebSocket not initialized');
      return;
    }

    // Initialize WebSocket connection
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const newSocket = io(backendUrl, {
      auth: {
        token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✓ WebSocket connected:', newSocket.id);
      setConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('✗ WebSocket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      setConnected(false);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up WebSocket connection');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const joinGame = (gameId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-game', gameId);
      console.log(`Joined game room: ${gameId}`);
    }
  };

  const leaveGame = (gameId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-game', gameId);
      console.log(`Left game room: ${gameId}`);
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, connected, joinGame, leaveGame }}>
      {children}
    </WebSocketContext.Provider>
  );
};
