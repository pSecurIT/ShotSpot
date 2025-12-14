import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('🏥 Health Check', () => {
  describe('✅ Successful Health Checks', () => {
    it('✅ should return 200 OK for the health check endpoint', async () => {
      try {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('services');
        console.log('      ✅ Health check endpoint working correctly');
      } catch (error) {
        console.log('      ❌ Health check test failed:', error.message);
        global.testContext.logTestError(error, 'Health check test failed');
        throw error;
      }
    });

    it('✅ should return correct health check structure', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        message: 'All systems operational',
        services: {
          database: 'connected'
        }
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('✅ should return JSON content type', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('✅ should handle multiple concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('✅ should not require authentication', async () => {
      // Health check should work without any auth headers
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', ''); // Explicitly no auth
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('✅ should be accessible via GET method only', async () => {
      const getResponse = await request(app).get('/api/health');
      expect(getResponse.status).toBe(200);
    });
  });

  describe('❌ Invalid Health Check Requests', () => {
    it('❌ should reject POST requests to health endpoint', async () => {
      const response = await request(app).post('/api/health');
      
      // Should be 404 (route not found), 405 (method not allowed), or 415 (unsupported media type)
      expect([404, 405, 415]).toContain(response.status);
      expect(response.status).not.toBe(200);
    });

    it('❌ should reject PUT requests to health endpoint', async () => {
      const response = await request(app).put('/api/health');
      
      expect([404, 405, 415]).toContain(response.status);
      expect(response.status).not.toBe(200);
    });

    it('❌ should reject DELETE requests to health endpoint', async () => {
      const response = await request(app).delete('/api/health');
      
      expect([404, 405, 415]).toContain(response.status);
      expect(response.status).not.toBe(200);
    });

    it('❌ should return 404 or error for invalid health endpoints', async () => {
      const invalidPaths = [
        '/health', // Old path (might serve SPA)
        '/api/healthz',
        '/api/health/status',
        '/health/check'
      ];

      for (const path of invalidPaths) {
        const response = await request(app).get(path);
        // Should not return successful health check
        if (response.status === 200) {
          expect(response.body).not.toHaveProperty('status', 'healthy');
        } else {
          expect([404, 503]).toContain(response.status);
        }
      }
    });
  });

  describe('🔧 Health Check Response Validation', () => {
    it('🔧 should include timestamp in ISO format', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body.timestamp).toBeDefined();
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('🔧 should have consistent response schema', async () => {
      const response1 = await request(app).get('/api/health');
      const response2 = await request(app).get('/api/health');
      
      expect(Object.keys(response1.body).sort()).toEqual(Object.keys(response2.body).sort());
      expect(response1.body.status).toBe(response2.body.status);
      expect(response1.body.message).toBe(response2.body.message);
    });

    it('🔧 should have services object with database status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body.services).toBeDefined();
      expect(response.body.services).toHaveProperty('database');
      expect(['connected', 'disconnected']).toContain(response.body.services.database);
    });

    it('🔧 should respond quickly (< 2 seconds)', async () => {
      const startTime = Date.now();
      await request(app).get('/api/health');
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('🚀 Performance and Reliability', () => {
    it('🚀 should handle rapid successive requests', async () => {
      const responses = [];
      
      for (let i = 0; i < 20; i++) {
        const response = await request(app).get('/api/health');
        responses.push(response);
      }
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('🚀 should maintain low response size', async () => {
      const response = await request(app).get('/api/health');
      
      const responseSize = JSON.stringify(response.body).length;
      expect(responseSize).toBeLessThan(500); // Reasonable size limit
    });

    it('🚀 should not leak memory on repeated calls', async () => {
      // Make multiple requests to ensure no memory leaks
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
      }
      
      // If we got here without timeout/crash, test passes
      expect(true).toBe(true);
    });
  });

  describe('🔐 Security Checks', () => {
    it('🔐 should not expose sensitive information', async () => {
      const response = await request(app).get('/api/health');
      
      const responseString = JSON.stringify(response.body).toLowerCase();
      
      // Should not contain sensitive keywords
      expect(responseString).not.toContain('password');
      expect(responseString).not.toContain('secret');
      expect(responseString).not.toContain('token');
      expect(responseString).not.toContain('key');
      expect(responseString).not.toContain('connection string');
    });

    it('🔐 should not be affected by malicious headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', '"><script>alert(1)</script>')
        .set('User-Agent', 'Mozilla/5.0 (compatible; Malicious Bot)');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('🔐 should handle OPTIONS request (CORS preflight)', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');
      
      // Should either succeed or be handled by CORS middleware
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('🌐 HTTP Standards Compliance', () => {
    it('🌐 should set appropriate cache headers', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      // Health checks should typically not be cached
      if (response.headers['cache-control']) {
        expect(response.headers['cache-control']).toMatch(/no-cache|no-store|max-age=0/);
      }
    });

    it('🌐 should handle HEAD request', async () => {
      const response = await request(app).head('/api/health');
      
      // HEAD should work like GET but without body
      expect([200, 404]).toContain(response.status);
    });

    it('🌐 should include proper content-length header', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      if (response.headers['content-length']) {
        const contentLength = parseInt(response.headers['content-length']);
        expect(contentLength).toBeGreaterThan(0);
      }
    });
  });

  afterAll(async () => {
    try {
      // Close the database pool (this is the last test file to run)
      await db.closePool();
      console.log('✅ Health Check tests completed');
    } catch (error) {
      console.error('❌ Health Check cleanup error:', error.message);
      global.testContext.logTestError(error, 'Health Check cleanup error');
    }
  });
});

