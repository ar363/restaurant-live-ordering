from ninja import NinjaAPI, Schema
from ninja.security import HttpBearer
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from .models import MenuItem, Order, OrderItem, Table
from typing import List, Optional
import jwt
from datetime import datetime, timedelta
from django.conf import settings
import redis
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Sum, Count, Avg, F, Q, DecimalField
from django.db.models.functions import TruncHour, TruncDate
from django.db.models import ExpressionWrapper
from django.utils import timezone

api = NinjaAPI()

# JWT Configuration
SECRET_KEY = getattr(settings, 'SECRET_KEY')
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 60 * 60 * 24 * 7  # 7 days

# Redis Configuration
REDIS_HOST = getattr(settings, 'REDIS_HOST', 'localhost')
REDIS_PORT = getattr(settings, 'REDIS_PORT', 6379)
REDIS_DB = getattr(settings, 'REDIS_DB', 0)
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)
CART_EXPIRY = 3600  # 1 hour

# Schemas
class TokenAuth(HttpBearer):
    def authenticate(self, request, token):
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            if user_id:
                return User.objects.get(id=user_id)
        except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
            return None

class UserSchema(Schema):
    username: str
    email: str
    password: str

class LoginSchema(Schema):
    username: str
    password: str

class MenuItemSchema(Schema):
    id: int = None
    name: str
    description: str = ""
    price: float
    category: str
    is_available: bool = True
    image: Optional[str] = None

class TableSchema(Schema):
    id: int = None
    table_number: int
    is_occupied: bool = False

class OrderItemSchema(Schema):
    id: int = None
    menu_item_id: int
    menu_item_name: Optional[str] = None
    quantity: int
    price_at_order: float
    special_instructions: str = ""

class OrderSchema(Schema):
    id: int = None
    table_id: int = None
    table_number: int = None
    status: str = "pending"
    special_instructions: str = ""
    payment_method: Optional[str] = None
    payment_status: bool = False
    total_amount: float = 0
    username: Optional[str] = None
    items: List[OrderItemSchema] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class CreateOrderSchema(Schema):
    table_id: int
    special_instructions: str = ""
    payment_method: str
    items: List[dict]

class UpdateOrderStatusSchema(Schema):
    status: str

class ErrorSchema(Schema):
    error: str

class AuthResponseSchema(Schema):
    token: str
    user: dict

class UserExistsSchema(Schema):
    exists: bool

class CartItemSchema(Schema):
    menu_item_id: int
    menu_item: MenuItemSchema
    quantity: int

class CartDataSchema(Schema):
    items: List[CartItemSchema]
    last_updated: int

class CartSyncRequestSchema(Schema):
    user_id: int
    cart: CartDataSchema

class CartSyncResponseSchema(Schema):
    success: bool

class CartGetResponseSchema(Schema):
    cart: Optional[CartDataSchema] = None

class CheckoutStatusSchema(Schema):
    is_checkout_in_progress: bool
    payment_method: Optional[str] = None
    special_instructions: str = ""

class StartCheckoutSchema(Schema):
    user_id: int
    payment_method: Optional[str] = None
    special_instructions: str = ""

class CreateOrderFromCartSchema(Schema):
    user_id: int
    table_number: int
    payment_method: str  # "upi", "card", or "cash"
    special_instructions: str = ""

class UpdateOrderStatusSchema(Schema):
    status: str

class KitchenLoginSchema(Schema):
    username: str
    password: str

class OwnerLoginSchema(Schema):
    username: str
    password: str

class DashboardStatsSchema(Schema):
    revenue_trends: List[dict]
    revenue_by_payment: dict
    revenue_by_hour: List[dict]
    top_items: List[dict]
    revenue_by_category: List[dict]
    low_performers: List[dict]
    avg_items_per_order: float
    unique_customers: int
    repeat_customer_rate: float
    customer_lifetime_value: float
    period_comparison: dict

# Auth endpoints
@api.post("/auth/check-user", auth=None, response=UserExistsSchema)
def check_user_exists(request, username: str):
    exists = User.objects.filter(username=username).exists()
    return {"exists": exists}

@api.post("/auth/register", auth=None, response={200: AuthResponseSchema, 400: ErrorSchema})
def register(request, data: UserSchema):
    if User.objects.filter(username=data.username).exists():
        return 400, {"error": "Username already exists"}
    
    user = User.objects.create_user(
        username=data.username,
        email=data.email,
        password=data.password
    )
    
    payload = {
        'user_id': user.id,
        'username': user.username,
        'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    return {
        "token": token,
        "user": {"id": user.id, "username": user.username, "email": user.email}
    }

@api.post("/auth/login", auth=None, response={200: AuthResponseSchema, 401: ErrorSchema})
def login(request, data: LoginSchema):
    user = authenticate(username=data.username, password=data.password)
    if user:
        payload = {
            'user_id': user.id,
            'username': user.username,
            'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
        
        return {
            "token": token,
            "user": {"id": user.id, "username": user.username}
        }
    return 401, {"error": "Invalid credentials"}

# Menu endpoints
@api.get("/menu", response=List[MenuItemSchema], auth=None)
def list_menu_items(request):
    items = MenuItem.objects.filter(is_available=True)
    return [
        {
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "price": float(item.price),
            "category": item.category,
            "is_available": item.is_available,
            "image": item.image.url if item.image else None
        }
        for item in items
    ]

@api.get("/menu/{item_id}", response=MenuItemSchema, auth=None)
def get_menu_item(request, item_id: int):
    item = get_object_or_404(MenuItem, id=item_id)
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": float(item.price),
        "category": item.category,
        "is_available": item.is_available,
        "image": item.image.url if item.image else None
    }

@api.post("/menu", auth=TokenAuth(), response={200: MenuItemSchema, 403: ErrorSchema})
def create_menu_item(request, data: MenuItemSchema):
    if not request.auth.is_staff:
        return 403, {"error": "Admin access required"}
    
    item = MenuItem.objects.create(
        name=data.name,
        description=data.description,
        price=data.price,
        category=data.category,
        is_available=data.is_available
    )
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": float(item.price),
        "category": item.category,
        "is_available": item.is_available,
        "image": None
    }

@api.put("/menu/{item_id}", auth=TokenAuth(), response={200: MenuItemSchema, 403: ErrorSchema})
def update_menu_item(request, item_id: int, data: MenuItemSchema):
    if not request.auth.is_staff:
        return 403, {"error": "Admin access required"}
    
    item = get_object_or_404(MenuItem, id=item_id)
    for attr, value in data.dict(exclude_unset=True).items():
        if attr != 'id':
            setattr(item, attr, value)
    item.save()
    
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": float(item.price),
        "category": item.category,
        "is_available": item.is_available,
        "image": item.image.url if item.image else None
    }

@api.delete("/menu/{item_id}", auth=TokenAuth(), response={200: dict, 403: ErrorSchema})
def delete_menu_item(request, item_id: int):
    if not request.auth.is_staff:
        return 403, {"error": "Admin access required"}
    
    item = get_object_or_404(MenuItem, id=item_id)
    item.delete()
    return {"success": True}

# Table endpoints
@api.get("/tables", response=List[TableSchema], auth=None)
def list_tables(request):
    tables = Table.objects.all()
    return [
        {
            "id": table.id,
            "table_number": table.table_number,
            "qr_code": table.qr_code,
            "is_occupied": table.is_occupied
        }
        for table in tables
    ]

@api.get("/tables/{table_id}", response=TableSchema, auth=None)
def get_table(request, table_id: int):
    table = get_object_or_404(Table, id=table_id)
    return {
        "id": table.id,
        "table_number": table.table_number,
        "qr_code": table.qr_code,
        "is_occupied": table.is_occupied
    }

# Order endpoints
@api.get("/orders", response=List[OrderSchema], auth=TokenAuth())
def list_orders(request):
    user = request.auth
    if user.is_staff:
        orders = Order.objects.all()
    else:
        orders = Order.objects.filter(user=user)
    
    result = []
    for order in orders:
        result.append({
            "id": order.id,
            "table_id": order.table.id if order.table else None,
            "table_number": order.table.table_number if order.table else None,
            "status": order.status,
            "special_instructions": order.special_instructions,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "total_amount": float(order.total_amount),
            "username": order.user.username,
            "items": [
                {
                    "id": item.id,
                    "menu_item_id": item.menu_item.id,
                    "menu_item_name": item.menu_item.name,
                    "quantity": item.quantity,
                    "price_at_order": float(item.price_at_order),
                    "special_instructions": item.special_instructions
                }
                for item in order.items.all()
            ]
        })
    return result

@api.post("/orders", response=OrderSchema, auth=TokenAuth())
def create_order(request, data: CreateOrderSchema):
    user = request.auth
    table = get_object_or_404(Table, id=data.table_id)
    
    order = Order.objects.create(
        user=user,
        table=table,
        special_instructions=data.special_instructions,
        payment_method=data.payment_method
    )
    
    total = 0
    for item_data in data.items:
        menu_item = get_object_or_404(MenuItem, id=item_data['menu_item_id'])
        order_item = OrderItem.objects.create(
            order=order,
            menu_item=menu_item,
            quantity=item_data['quantity'],
            price_at_order=menu_item.price,
            special_instructions=item_data.get('special_instructions', '')
        )
        total += float(order_item.get_subtotal())
    
    order.total_amount = total
    order.save()
    
    return {
        "id": order.id,
        "table_id": order.table.id,
        "table_number": order.table.table_number,
        "status": order.status,
        "special_instructions": order.special_instructions,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "total_amount": float(order.total_amount),
        "username": order.user.username,
        "items": [
            {
                "id": item.id,
                "menu_item_id": item.menu_item.id,
                "menu_item_name": item.menu_item.name,
                "quantity": item.quantity,
                "price_at_order": float(item.price_at_order),
                "special_instructions": item.special_instructions
            }
            for item in order.items.all()
        ]
    }

@api.get("/orders/{order_id}", auth=TokenAuth(), response={200: OrderSchema, 403: ErrorSchema})
def get_order(request, order_id: int):
    user = request.auth
    order = get_object_or_404(Order, id=order_id)
    
    if not user.is_staff and order.user != user:
        return 403, {"error": "Access denied"}
    
    return {
        "id": order.id,
        "table_id": order.table.id if order.table else None,
        "table_number": order.table.table_number if order.table else None,
        "status": order.status,
        "special_instructions": order.special_instructions,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "total_amount": float(order.total_amount),
        "username": order.user.username,
        "items": [
            {
                "id": item.id,
                "menu_item_id": item.menu_item.id,
                "menu_item_name": item.menu_item.name,
                "quantity": item.quantity,
                "price_at_order": float(item.price_at_order),
                "special_instructions": item.special_instructions
            }
            for item in order.items.all()
        ]
    }

@api.patch("/orders/{order_id}/status", auth=TokenAuth(), response={200: OrderSchema, 400: ErrorSchema})
def update_order_status(request, order_id: int, data: UpdateOrderStatusSchema):
    order = get_object_or_404(Order, id=order_id)
    
    if data.status not in dict(Order.STATUS_CHOICES):
        return 400, {"error": "Invalid status"}
    
    order.status = data.status
    order.save()
    
    return {
        "id": order.id,
        "table_id": order.table.id if order.table else None,
        "table_number": order.table.table_number if order.table else None,
        "status": order.status,
        "special_instructions": order.special_instructions,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "total_amount": float(order.total_amount),
        "username": order.user.username,
        "items": []
    }

# Kitchen dashboard
@api.post("/kitchen/login", auth=None, response={200: AuthResponseSchema, 401: ErrorSchema, 403: ErrorSchema})
def kitchen_login(request, data: KitchenLoginSchema):
    """Login for kitchen staff only"""
    user = authenticate(username=data.username, password=data.password)
    if user:
        if not user.is_staff:
            return 403, {"error": "Staff access required"}
        
        payload = {
            'user_id': user.id,
            'username': user.username,
            'is_staff': user.is_staff,
            'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
        
        return {
            "token": token,
            "user": {"id": user.id, "username": user.username, "is_staff": user.is_staff}
        }
    return 401, {"error": "Invalid credentials"}

@api.post("/owner/login", auth=None, response={200: AuthResponseSchema, 401: ErrorSchema, 403: ErrorSchema})
def owner_login(request, data: OwnerLoginSchema):
    """Login for owner/superuser only"""
    user = authenticate(username=data.username, password=data.password)
    if user:
        if not user.is_superuser:
            return 403, {"error": "Owner access required"}
        
        payload = {
            'user_id': user.id,
            'username': user.username,
            'is_superuser': user.is_superuser,
            'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
        
        return {
            "token": token,
            "user": {"id": user.id, "username": user.username, "is_superuser": user.is_superuser}
        }
    return 401, {"error": "Invalid credentials"}

@api.get("/kitchen/orders", response=List[OrderSchema], auth=TokenAuth())
def get_kitchen_orders(request):
    """Get all active orders for kitchen dashboard"""
    if not request.auth.is_staff:
        return []
    
    orders = Order.objects.exclude(status__in=['completed', 'cancelled']).order_by('created_at')
    
    result = []
    for order in orders:
        result.append({
            "id": order.id,
            "table_id": order.table.id if order.table else None,
            "table_number": order.table.table_number if order.table else None,
            "status": order.status,
            "special_instructions": order.special_instructions,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "total_amount": float(order.total_amount),
            "username": order.user.username,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "items": [
                {
                    "id": item.id,
                    "menu_item_id": item.menu_item.id,
                    "menu_item_name": item.menu_item.name,
                    "quantity": item.quantity,
                    "price_at_order": float(item.price_at_order),
                    "special_instructions": item.special_instructions
                }
                for item in order.items.all()
            ]
        })
    return result

@api.put("/kitchen/orders/{order_id}/status", auth=TokenAuth(), response={200: OrderSchema, 403: ErrorSchema, 404: ErrorSchema})
def update_order_status(request, order_id: int, data: UpdateOrderStatusSchema):
    """Update order status"""
    if not request.auth.is_staff:
        return 403, {"error": "Staff access required"}
    
    try:
        order = Order.objects.get(id=order_id)
        order.status = data.status
        
        # If moving to delivered and payment method is not cash, mark as completed
        if data.status == 'delivered' and order.payment_method != 'cash':
            order.status = 'completed'
        
        order.save()
        
        # Broadcast order update via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'kitchen',
            {
                'type': 'order_update',
                'order': {
                    "id": order.id,
                    "table_id": order.table.id if order.table else None,
                    "table_number": order.table.table_number if order.table else None,
                    "status": order.status,
                    "special_instructions": order.special_instructions,
                    "payment_method": order.payment_method,
                    "payment_status": order.payment_status,
                    "total_amount": float(order.total_amount),
                    "username": order.user.username,
                    "items": [
                        {
                            "id": item.id,
                            "menu_item_id": item.menu_item.id,
                            "menu_item_name": item.menu_item.name,
                            "quantity": item.quantity,
                            "price_at_order": float(item.price_at_order),
                            "special_instructions": item.special_instructions
                        }
                        for item in order.items.all()
                    ]
                }
            }
        )
        
        return {
            "id": order.id,
            "table_id": order.table.id if order.table else None,
            "table_number": order.table.table_number if order.table else None,
            "status": order.status,
            "special_instructions": order.special_instructions,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "total_amount": float(order.total_amount),
            "username": order.user.username,
            "items": [
                {
                    "id": item.id,
                    "menu_item_id": item.menu_item.id,
                    "menu_item_name": item.menu_item.name,
                    "quantity": item.quantity,
                    "price_at_order": float(item.price_at_order),
                    "special_instructions": item.special_instructions
                }
                for item in order.items.all()
            ]
        }
    except Order.DoesNotExist:
        return 404, {"error": "Order not found"}

@api.get("/kitchen/dashboard", response=List[OrderSchema], auth=TokenAuth())
def kitchen_dashboard(request):
    if not request.auth.is_staff:
        return []
    
    orders = Order.objects.exclude(status__in=['completed', 'cancelled']).order_by('-created_at')
    
    result = []
    for order in orders:
        result.append({
            "id": order.id,
            "table_id": order.table.id if order.table else None,
            "table_number": order.table.table_number if order.table else None,
            "status": order.status,
            "special_instructions": order.special_instructions,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "total_amount": float(order.total_amount),
            "username": order.user.username,
            "items": [
                {
                    "id": item.id,
                    "menu_item_id": item.menu_item.id,
                    "menu_item_name": item.menu_item.name,
                    "quantity": item.quantity,
                    "price_at_order": float(item.price_at_order),
                    "special_instructions": item.special_instructions
                }
                for item in order.items.all()
            ]
        })
    return result

@api.get("/ping", auth=None)
def ping(request):
    return {"ping": "pong"}

# Cart endpoints
@api.post("/cart/sync", auth=TokenAuth(), response=CartSyncResponseSchema)
def sync_cart(request, data: CartSyncRequestSchema):
    """Sync cart data to Redis with 1 hour expiry"""
    try:
        user_id = data.user_id
        cart_key = f"cart:{user_id}"
        last_updated_key = f"cart:{user_id}:last_updated"
        
        # Store cart data
        cart_json = json.dumps({
            "items": [
                {
                    "menu_item_id": item.menu_item_id,
                    "menu_item": {
                        "id": item.menu_item.id,
                        "name": item.menu_item.name,
                        "description": item.menu_item.description,
                        "price": float(item.menu_item.price),
                        "category": item.menu_item.category,
                        "is_available": item.menu_item.is_available,
                        "image": item.menu_item.image,
                    },
                    "quantity": item.quantity,
                }
                for item in data.cart.items
            ],
            "last_updated": data.cart.last_updated,
        })
        
        redis_client.setex(cart_key, CART_EXPIRY, cart_json)
        redis_client.setex(last_updated_key, CART_EXPIRY, str(data.cart.last_updated))
        
        # Broadcast cart update via WebSocket
        channel_layer = get_channel_layer()
        cart_data = json.loads(cart_json)
        async_to_sync(channel_layer.group_send)(
            f'cart_{user_id}',
            {
                'type': 'cart_update',
                'cart_data': cart_data
            }
        )
        
        return {"success": True}
    except Exception as e:
        print(f"Error syncing cart: {e}")
        return {"success": False}

@api.get("/cart/sync", auth=TokenAuth(), response=CartGetResponseSchema)
def get_cart(request, user_id: int, last_updated: Optional[int] = None):
    """Get cart data from Redis. Returns null if last_updated matches (no changes)."""
    try:
        cart_key = f"cart:{user_id}"
        cart_data = redis_client.get(cart_key)
        
        if not cart_data:
            return {"cart": None}
        
        cart_dict = json.loads(cart_data)
        
        # If last_updated is provided and matches, return null (no changes)
        if last_updated is not None and cart_dict.get("last_updated") == last_updated:
            return {"cart": None}
        
        return {"cart": cart_dict}
    except Exception as e:
        print(f"Error fetching cart: {e}")
        return {"cart": None}

# Checkout endpoints
@api.post("/checkout/start", auth=TokenAuth(), response=CheckoutStatusSchema)
def start_checkout(request, data: StartCheckoutSchema):
    """Start checkout process - stores payment details for collaborative checkout"""
    try:
        user_id = data.user_id
        checkout_key = f"checkout:{user_id}"
        
        # Store checkout state with payment details
        checkout_data = {
            "payment_method": data.payment_method,
            "special_instructions": data.special_instructions
        }
        redis_client.setex(checkout_key, 300, json.dumps(checkout_data))  # 5 min expiry
        
        # Broadcast checkout status via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'cart_{user_id}',
            {
                'type': 'checkout_status',
                'is_checkout_in_progress': True,
                'payment_method': data.payment_method,
                'special_instructions': data.special_instructions
            }
        )
        
        return {
            "is_checkout_in_progress": True,
            "payment_method": data.payment_method,
            "special_instructions": data.special_instructions
        }
    except Exception as e:
        print(f"Error starting checkout: {e}")
        return {"is_checkout_in_progress": False, "payment_method": None, "special_instructions": ""}

@api.get("/checkout/status", auth=TokenAuth(), response=CheckoutStatusSchema)
def get_checkout_status(request, user_id: int):
    """Get checkout status for a user"""
    try:
        checkout_key = f"checkout:{user_id}"
        checkout_data = redis_client.get(checkout_key)
        
        if checkout_data:
            data = json.loads(checkout_data)
            return {
                "is_checkout_in_progress": True,
                "payment_method": data.get("payment_method"),
                "special_instructions": data.get("special_instructions", "")
            }
        return {"is_checkout_in_progress": False, "payment_method": None, "special_instructions": ""}
    except Exception as e:
        print(f"Error getting checkout status: {e}")
        return {"is_checkout_in_progress": False, "payment_method": None, "special_instructions": ""}

@api.post("/checkout/cancel", auth=TokenAuth(), response=CheckoutStatusSchema)
def cancel_checkout(request, user_id: int):
    """Cancel checkout process"""
    try:
        checkout_key = f"checkout:{user_id}"
        redis_client.delete(checkout_key)
        
        # Broadcast checkout cancellation via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'cart_{user_id}',
            {
                'type': 'checkout_status',
                'is_checkout_in_progress': False,
                'payment_method': None,
                'special_instructions': ""
            }
        )
        
        return {"is_checkout_in_progress": False, "payment_method": None, "special_instructions": ""}
    except Exception as e:
        print(f"Error canceling checkout: {e}")
        return {"is_checkout_in_progress": False, "payment_method": None, "special_instructions": ""}

@api.post("/checkout/update", auth=TokenAuth(), response=CheckoutStatusSchema)
def update_checkout(request, data: StartCheckoutSchema):
    """Update payment method or special instructions during checkout"""
    try:
        user_id = data.user_id
        checkout_key = f"checkout:{user_id}"
        
        # Update checkout data
        checkout_data = {
            "payment_method": data.payment_method,
            "special_instructions": data.special_instructions
        }
        redis_client.setex(checkout_key, 300, json.dumps(checkout_data))
        
        # Broadcast update via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'cart_{user_id}',
            {
                'type': 'checkout_status',
                'is_checkout_in_progress': True,
                'payment_method': data.payment_method,
                'special_instructions': data.special_instructions
            }
        )
        
        return {
            "is_checkout_in_progress": True,
            "payment_method": data.payment_method,
            "special_instructions": data.special_instructions
        }
    except Exception as e:
        print(f"Error updating checkout: {e}")
        return {"is_checkout_in_progress": False, "payment_method": None, "special_instructions": ""}

@api.post("/checkout/complete", auth=TokenAuth(), response={200: OrderSchema, 400: ErrorSchema})
def complete_checkout(request, data: CreateOrderFromCartSchema):
    """Complete checkout - create order from cart and clear cart"""
    try:
        user_id = data.user_id
        
        # Get cart data
        cart_key = f"cart:{user_id}"
        cart_data = redis_client.get(cart_key)
        
        if not cart_data:
            return 400, {"error": "Cart is empty"}
        
        cart_dict = json.loads(cart_data)
        cart_items = cart_dict.get("items", [])
        
        if not cart_items:
            return 400, {"error": "Cart is empty"}
        
        # Get or create table
        table, created = Table.objects.get_or_create(
            table_number=data.table_number,
            defaults={"is_occupied": True}
        )
        
        # Calculate total
        total_amount = sum(
            item["menu_item"]["price"] * item["quantity"]
            for item in cart_items
        )
        
        # Create order
        order = Order.objects.create(
            user=request.auth,
            table=table,
            status="pending",
            special_instructions=data.special_instructions,
            payment_method=data.payment_method,
            payment_status=(data.payment_method != "cash"),  # Cash is unpaid, UPI/Card are paid
            total_amount=total_amount
        )
        
        # Create order items
        for item in cart_items:
            menu_item = MenuItem.objects.get(id=item["menu_item_id"])
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item["quantity"],
                price_at_order=item["menu_item"]["price"]
            )
        
        # Clear cart and checkout status atomically
        pipe = redis_client.pipeline()
        pipe.delete(cart_key)
        pipe.delete(f"cart:{user_id}:last_updated")
        pipe.delete(f"checkout:{user_id}")
        pipe.execute()
        
        # Broadcast cart clear and checkout completion via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'cart_{user_id}',
            {
                'type': 'checkout_complete',
                'order_id': order.id
            }
        )
        
        # Broadcast new order to kitchen dashboard
        async_to_sync(channel_layer.group_send)(
            'kitchen',
            {
                'type': 'new_order',
                'order': {
                    "id": order.id,
                    "table_id": table.id,
                    "table_number": table.table_number,
                    "status": order.status,
                    "special_instructions": order.special_instructions,
                    "payment_method": order.payment_method,
                    "payment_status": order.payment_status,
                    "total_amount": float(order.total_amount),
                    "username": order.user.username,
                    "items": [
                        {
                            "id": item.id,
                            "menu_item_id": item.menu_item.id,
                            "menu_item_name": item.menu_item.name,
                            "quantity": item.quantity,
                            "price_at_order": float(item.price_at_order),
                            "special_instructions": item.special_instructions
                        }
                        for item in order.items.all()
                    ]
                }
            }
        )
        
        return {
            "id": order.id,
            "table_id": table.id,
            "table_number": table.table_number,
            "status": order.status,
            "special_instructions": order.special_instructions,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "total_amount": float(order.total_amount),
            "username": order.user.username,
            "items": [
                {
                    "id": item.id,
                    "menu_item_id": item.menu_item.id,
                    "menu_item_name": item.menu_item.name,
                    "quantity": item.quantity,
                    "price_at_order": float(item.price_at_order),
                    "special_instructions": item.special_instructions
                }
                for item in order.items.all()
            ]
        }
    except Exception as e:
        print(f"Error completing checkout: {e}")
        return 400, {"error": str(e)}


# Owner Dashboard Analytics Endpoints
@api.get("/owner/analytics", response=DashboardStatsSchema, auth=TokenAuth())
def get_owner_analytics(request, period: str = "today"):
    """Get comprehensive analytics for owner dashboard"""
    if not request.auth.is_superuser:
        return 403, {"error": "Owner access required"}
    
    # Determine date range based on period
    now = timezone.now()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        previous_start = start_date - timedelta(days=1)
        previous_end = start_date
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        previous_start = start_date - timedelta(days=7)
        previous_end = start_date
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Previous month
        if start_date.month == 1:
            previous_start = start_date.replace(year=start_date.year - 1, month=12)
        else:
            previous_start = start_date.replace(month=start_date.month - 1)
        previous_end = start_date
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        previous_start = start_date - timedelta(days=1)
        previous_end = start_date
    
    end_date = now
    
    # Filter completed orders only
    current_orders = Order.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date,
        status='completed'
    )
    
    previous_orders = Order.objects.filter(
        created_at__gte=previous_start,
        created_at__lt=previous_end,
        status='completed'
    )
    
    # Revenue Trends
    if period == "today":
        # Hourly breakdown for today
        revenue_trends = list(
            current_orders.annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(revenue=Sum('total_amount'))
            .order_by('hour')
        )
        revenue_trends = [
            {
                'time': item['hour'].strftime('%H:%M') if item['hour'] else '',
                'revenue': float(item['revenue'] or 0)
            }
            for item in revenue_trends
        ]
    else:
        # Daily breakdown for week/month
        revenue_trends = list(
            current_orders.annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(revenue=Sum('total_amount'))
            .order_by('date')
        )
        revenue_trends = [
            {
                'time': item['date'].strftime('%Y-%m-%d') if item['date'] else '',
                'revenue': float(item['revenue'] or 0)
            }
            for item in revenue_trends
        ]
    
    # Revenue by Payment Method
    payment_breakdown = current_orders.values('payment_method').annotate(
        revenue=Sum('total_amount')
    )
    revenue_by_payment = {
        item['payment_method'] or 'unknown': float(item['revenue'] or 0)
        for item in payment_breakdown
    }
    
    # Revenue by Hour (for the entire period)
    revenue_by_hour_data = current_orders.annotate(
        hour=TruncHour('created_at')
    ).values('hour').annotate(
        revenue=Sum('total_amount')
    ).order_by('hour')
    
    revenue_by_hour = [
        {
            'hour': item['hour'].hour if item['hour'] else 0,
            'revenue': float(item['revenue'] or 0)
        }
        for item in revenue_by_hour_data
    ]
    
    # Top Selling Items
    top_items_data = OrderItem.objects.filter(
        order__in=current_orders
    ).annotate(
        subtotal=ExpressionWrapper(F('quantity') * F('price_at_order'), output_field=DecimalField())
    ).values(
        'menu_item__name'
    ).annotate(
        quantity=Sum('quantity'),
        revenue=Sum('subtotal')
    ).order_by('-revenue')[:10]
    
    top_items = [
        {
            'name': item['menu_item__name'],
            'quantity': item['quantity'],
            'revenue': float(item['revenue'] or 0)
        }
        for item in top_items_data
    ]
    
    # Revenue by Category
    revenue_by_category_data = OrderItem.objects.filter(
        order__in=current_orders
    ).annotate(
        subtotal=ExpressionWrapper(F('quantity') * F('price_at_order'), output_field=DecimalField())
    ).values(
        'menu_item__category'
    ).annotate(
        revenue=Sum('subtotal')
    ).order_by('-revenue')
    
    revenue_by_category = [
        {
            'category': item['menu_item__category'],
            'revenue': float(item['revenue'] or 0)
        }
        for item in revenue_by_category_data
    ]
    
    # Low Performers (items with low sales)
    all_items_sales = OrderItem.objects.filter(
        order__in=current_orders
    ).annotate(
        subtotal=ExpressionWrapper(F('quantity') * F('price_at_order'), output_field=DecimalField())
    ).values(
        'menu_item__name'
    ).annotate(
        quantity=Sum('quantity'),
        revenue=Sum('subtotal')
    ).order_by('revenue')[:10]
    
    low_performers = [
        {
            'name': item['menu_item__name'],
            'quantity': item['quantity'],
            'revenue': float(item['revenue'] or 0)
        }
        for item in all_items_sales
    ]
    
    # Average Items per Order
    avg_items = OrderItem.objects.filter(
        order__in=current_orders
    ).values('order').annotate(
        total_items=Sum('quantity')
    ).aggregate(
        avg=Avg('total_items')
    )
    avg_items_per_order = float(avg_items['avg'] or 0)
    
    # Unique Customers
    unique_customers = current_orders.values('user').distinct().count()
    
    # Repeat Customer Rate
    total_customers = current_orders.values('user').distinct().count()
    repeat_customers = current_orders.values('user').annotate(
        order_count=Count('id')
    ).filter(order_count__gt=1).count()
    repeat_customer_rate = (repeat_customers / total_customers * 100) if total_customers > 0 else 0
    
    # Customer Lifetime Value
    all_time_orders = Order.objects.filter(status='completed')
    total_revenue = all_time_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    total_unique_customers = all_time_orders.values('user').distinct().count()
    customer_lifetime_value = float(total_revenue / total_unique_customers) if total_unique_customers > 0 else 0
    
    # Period Comparison
    current_revenue = current_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    previous_revenue = previous_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    
    current_order_count = current_orders.count()
    previous_order_count = previous_orders.count()
    
    revenue_change = ((current_revenue - previous_revenue) / previous_revenue * 100) if previous_revenue > 0 else 0
    order_change = ((current_order_count - previous_order_count) / previous_order_count * 100) if previous_order_count > 0 else 0
    
    period_comparison = {
        'current_revenue': float(current_revenue),
        'previous_revenue': float(previous_revenue),
        'revenue_change_percent': float(revenue_change),
        'current_orders': current_order_count,
        'previous_orders': previous_order_count,
        'order_change_percent': float(order_change)
    }
    
    return {
        'revenue_trends': revenue_trends,
        'revenue_by_payment': revenue_by_payment,
        'revenue_by_hour': revenue_by_hour,
        'top_items': top_items,
        'revenue_by_category': revenue_by_category,
        'low_performers': low_performers,
        'avg_items_per_order': avg_items_per_order,
        'unique_customers': unique_customers,
        'repeat_customer_rate': float(repeat_customer_rate),
        'customer_lifetime_value': customer_lifetime_value,
        'period_comparison': period_comparison
    }



