import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import jwt
from django.conf import settings
from django.contrib.auth.models import User

SECRET_KEY = getattr(settings, 'SECRET_KEY')
JWT_ALGORITHM = 'HS256'


class CartConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get user_id from query parameters
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
        
        # Authenticate using token
        token = params.get('token')
        if not token:
            await self.close()
            return
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            if not user_id:
                await self.close()
                return
            
            self.user_id = user_id
            self.room_group_name = f'cart_{user_id}'
            
            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
        except (jwt.ExpiredSignatureError, jwt.DecodeError):
            await self.close()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        # Handle incoming messages (if needed)
        pass

    # Receive message from room group
    async def cart_update(self, event):
        cart_data = event['cart_data']
        
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'cart_update',
            'data': cart_data
        }))
