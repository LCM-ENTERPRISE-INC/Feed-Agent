import express, { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import request from 'supertest';
const EventSource = require('eventsource').EventSource;
import jwt from 'jsonwebtoken';
import { WhatsAppController } from './src/controllers/WhatsAppController';
import whatsAppInstanceManager from './src/services/WhatsAppInstanceManager';

// Mock JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Create a mock Express App
const app = express();
app.use(express.json());

// Mock Auth Middleware
const mockAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    (req as any).user = jwt.verify(token as string, JWT_SECRET) as any;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const controller = new WhatsAppController();

// Setup routes
app.get('/api/whatsapp/instances/:id/messages/stream', mockAuth, controller.streamMessages);
app.post('/api/whatsapp/instances/:id/test-message', mockAuth, controller.sendTestMessage);

// Mock WhatsApp Instance
class MockLiveInstance extends EventEmitter {
  private userId: number;
  
  constructor(userId: number) {
    super();
    this.userId = userId;
  }
  
  getUserId() { return this.userId; }
  
  async sendMessage(to: string, text: string) {
    console.log(`[MockInstance] Received request to send message to ${to}: "${text}"`);
    // Simulate echoing the message back as an incoming message after 100ms
    setTimeout(() => {
      this.emit('wa:message', {
        fromNumber: to,
        text: `Echo do Backend: ${text}`,
        timestamp: Date.now(),
        messageId: `mock-msg-${Date.now()}`
      });
    }, 100);
  }
}

// Inject Mock into Manager
const instanceId = 999;
const mockInstance = new MockLiveInstance(1);
(whatsAppInstanceManager as any).instances = new Map([[instanceId, mockInstance]]);
(whatsAppInstanceManager as any).getInstance = (id: number) => {
  return id === instanceId ? mockInstance : undefined;
};

async function runTest() {
  console.log('--- Iniciando Teste de Integração (Chat <-> Backend SSE) ---');
  
  const server = app.listen(0, () => {
    const port = (server.address() as any).port;
    const token = jwt.sign({ userId: 1, email: 'test@lcm.com' }, JWT_SECRET);
    
    // 1. Connect to SSE
    const sseUrl = `http://localhost:${port}/api/whatsapp/instances/${instanceId}/messages/stream?token=${token}`;
    console.log(`[Test] Conectando ao SSE stream em: ${sseUrl}`);
    
    const es = new EventSource(sseUrl);
    
    es.addEventListener('connected', (e: any) => {
      console.log('[SSE] Conexão estabelecida:', e.data);
      
      // 2. Simulate Frontend sending a message via POST
      const targetPhone = '5511999999999';
      const messageToSend = 'Olá, este é um teste de integração!';
      
      console.log(`\n[Test] Simulando Frontend enviando POST para /test-message...`);
      request(app)
        .post(`/api/whatsapp/instances/${instanceId}/test-message`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          phoneNumber: targetPhone,
          message: messageToSend
        })
        .expect(200)
        .end((err, res) => {
          if (err) {
            console.error('[Test] Erro ao enviar POST:', err);
            process.exit(1);
          }
          console.log('[Test] POST enviado com sucesso! Resposta:', res.body);
        });
    });
    
    es.addEventListener('message', (e: any) => {
      console.log('\n[SSE] Mensagem recebida via Stream (SSE):', e.data);
      console.log('\n--- Teste Concluído com Sucesso! ---');
      es.close();
      server.close();
      process.exit(0);
    });
    
    es.addEventListener('error', (err: any) => {
      console.error('[SSE] Erro:', err);
      process.exit(1);
    });
  });
}

runTest();
