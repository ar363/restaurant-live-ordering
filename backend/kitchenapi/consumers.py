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
            await self.accept()
            await self.close(code=4001)
            return
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            if not user_id:
                await self.accept()
                await self.close(code=4002)
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
            await self.accept()
            await self.close(code=4003)

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
    
    async def checkout_status(self, event):
        # Send checkout status update
        await self.send(text_data=json.dumps({
            'type': 'checkout_status',
            'is_checkout_in_progress': event['is_checkout_in_progress'],
            'payment_method': event.get('payment_method'),
            'special_instructions': event.get('special_instructions', '')
        }))
    
    async def checkout_complete(self, event):
        # Send checkout completion
        await self.send(text_data=json.dumps({
            'type': 'checkout_complete',
            'order_id': event['order_id']
        }))


class KitchenConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
        
        token = params.get('token')
        if not token:
            await self.accept()
            await self.close(code=4001)
            return
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            is_staff = payload.get('is_staff', False)
            
            if not is_staff:
                await self.accept()
                await self.close(code=4003)
                return
            
            self.user_id = payload.get('user_id')
            self.room_group_name = 'kitchen'
            
            # Accept FIRST
            await self.accept()
            
            # Then add to group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
        except (jwt.ExpiredSignatureError, jwt.DecodeError):
            await self.accept()
            await self.close(code=4002)

    async def disconnect(self, close_code):
        # Leave kitchen group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        # Handle incoming messages (if needed)
        pass

    # Receive new order
    async def new_order(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_order',
            'order': event['order']
        }))
    
    # Receive order update
    async def order_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'order': event['order']
        }))
