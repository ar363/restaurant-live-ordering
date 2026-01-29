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

api = NinjaAPI()

# JWT Configuration
SECRET_KEY = getattr(settings, 'SECRET_KEY')
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 60 * 60 * 24 * 7  # 7 days

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
    qr_code: str = ""
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

class CreateOrderSchema(Schema):
    table_id: int
    special_instructions: str = ""
    payment_method: str
    items: List[dict]

class UpdateOrderStatusSchema(Schema):
    status: str

# Auth endpoints
@api.post("/auth/register", auth=None)
def register(request, data: UserSchema):
    if User.objects.filter(username=data.username).exists():
        return {"error": "Username already exists"}, 400
    
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

@api.post("/auth/login", auth=None)
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
    return {"error": "Invalid credentials"}, 401

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

@api.post("/menu", response=MenuItemSchema, auth=TokenAuth())
def create_menu_item(request, data: MenuItemSchema):
    if not request.auth.is_staff:
        return {"error": "Admin access required"}, 403
    
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

@api.put("/menu/{item_id}", response=MenuItemSchema, auth=TokenAuth())
def update_menu_item(request, item_id: int, data: MenuItemSchema):
    if not request.auth.is_staff:
        return {"error": "Admin access required"}, 403
    
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

@api.delete("/menu/{item_id}", auth=TokenAuth())
def delete_menu_item(request, item_id: int):
    if not request.auth.is_staff:
        return {"error": "Admin access required"}, 403
    
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

@api.get("/orders/{order_id}", response=OrderSchema, auth=TokenAuth())
def get_order(request, order_id: int):
    user = request.auth
    order = get_object_or_404(Order, id=order_id)
    
    if not user.is_staff and order.user != user:
        return {"error": "Access denied"}, 403
    
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

@api.patch("/orders/{order_id}/status", response=OrderSchema, auth=TokenAuth())
def update_order_status(request, order_id: int, data: UpdateOrderStatusSchema):
    order = get_object_or_404(Order, id=order_id)
    
    if data.status not in dict(Order.STATUS_CHOICES):
        return {"error": "Invalid status"}, 400
    
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
@api.get("/kitchen/dashboard", response=List[OrderSchema], auth=TokenAuth())
def kitchen_dashboard(request):
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
