import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import jwt
from django.conf import settings
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)
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
            logger.warning("CartConsumer: No token provided")
            await self.accept()
            await self.close(code=4001)
            return
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            if not user_id:
                logger.warning("CartConsumer: No user_id in token")
                await self.accept()
                await self.close(code=4002)
                return
            
            self.user_id = user_id
            self.room_group_name = f'cart_{user_id}'
            
            await self.accept()
            
            # Join room group
            try:
                await self.channel_layer.group_add(
                    self.room_group_name,
                    self.channel_name
                )
                logger.info(f"CartConsumer: User {user_id} connected to cart group")
            except Exception as e:
                logger.error(f"CartConsumer: Error adding to group: {e}")
                await self.close(code=1011)
                
        except (jwt.ExpiredSignatureError, jwt.DecodeError) as e:
            logger.warning(f"CartConsumer: Token validation failed: {e}")
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
            logger.warning("KitchenConsumer: No token provided")
            await self.accept()
            await self.close(code=4001)
            return
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            is_staff = payload.get('is_staff', False)
            
            if not is_staff:
                logger.warning("KitchenConsumer: Non-staff user attempted kitchen access")
                await self.accept()
                await self.close(code=4003)
                return
            
            self.user_id = payload.get('user_id')
            self.room_group_name = 'kitchen'
            
            await self.accept()
            
            # Join kitchen group
            try:
                await self.channel_layer.group_add(
                    self.room_group_name,
                    self.channel_name
                )
                logger.info(f"KitchenConsumer: Staff user {self.user_id} connected to kitchen group")
            except Exception as e:
                logger.error(f"KitchenConsumer: Error adding to group: {e}")
                await self.close(code=1011)
                
        except (jwt.ExpiredSignatureError, jwt.DecodeError) as e:
            logger.warning(f"KitchenConsumer: Token validation failed: {e}")
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
