from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.core.files import File
from kitchenapi.models import Table, MenuItem, Order, OrderItem
from decimal import Decimal
from pathlib import Path
import random
from faker import Faker


class Command(BaseCommand):
    help = 'Populate the database with sample data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before populating',
        )

    def handle(self, *args, **options):
        fake = Faker('en_IN')  # Indian locale for names
        
        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing data...'))
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            MenuItem.objects.all().delete()
            Table.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
            self.stdout.write(self.style.SUCCESS('✓ Cleared existing data'))

        # Create users
        self.stdout.write('Creating users...')
        users = []
        for i in range(1, 11):  # Create 10 users
            phone_number = f'{random.randint(7, 9)}{random.randint(100000000, 999999999)}'
            user, created = User.objects.get_or_create(
                username=phone_number,
                defaults={
                    'email': f'{phone_number}@restaurant.local',
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                }
            )
            if created:
                user.set_password('123123')
                user.save()
            users.append(user)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(users)} users'))

        # Create tables
        self.stdout.write('Creating tables...')
        tables = []
        for i in range(1, 11):
            table, created = Table.objects.get_or_create(
                table_number=i,
                defaults={'is_occupied': random.choice([True, False])}
            )
            tables.append(table)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(tables)} tables'))

        # Create menu items
        self.stdout.write('Creating menu items...')
        
        menu_data = [
            # Starters
            {
                'name': 'Spring Rolls',
                'description': 'Crispy vegetable spring rolls served with sweet chili sauce',
                'price': Decimal('120.00'),
                'category': 'Starters',
                'is_available': True,
                'image_query': 'spring-rolls',
            },
            {
                'name': 'Paneer Tikka',
                'description': 'Grilled cottage cheese marinated in Indian spices',
                'price': Decimal('180.00'),
                'category': 'Starters',
                'is_available': True,
                'image_query': 'paneer-tikka',
            },
            {
                'name': 'Chicken Wings',
                'description': 'Spicy buffalo wings with ranch dip',
                'price': Decimal('220.00'),
                'category': 'Starters',
                'is_available': True,
                'image_query': 'chicken-wings',
            },
            {
                'name': 'French Fries',
                'description': 'Crispy golden fries with ketchup',
                'price': Decimal('100.00'),
                'category': 'Starters',
                'is_available': True,
                'image_query': 'french-fries',
            },
            # Main Course
            {
                'name': 'Butter Chicken',
                'description': 'Tender chicken in rich tomato and butter gravy',
                'price': Decimal('320.00'),
                'category': 'Main Course',
                'is_available': True,
                'image_query': 'butter-chicken',
            },
            {
                'name': 'Paneer Butter Masala',
                'description': 'Cottage cheese cubes in creamy tomato gravy',
                'price': Decimal('280.00'),
                'category': 'Main Course',
                'is_available': True,
                'image_query': 'paneer-butter-masala',
            },
            {
                'name': 'Biryani (Veg)',
                'description': 'Fragrant basmati rice with mixed vegetables and spices',
                'price': Decimal('250.00'),
                'category': 'Main Course',
                'is_available': True,
                'image_query': 'vegetable-biryani',
            },
            {
                'name': 'Biryani (Chicken)',
                'description': 'Aromatic basmati rice with tender chicken pieces',
                'price': Decimal('320.00'),
                'category': 'Main Course',
                'is_available': True,
                'image_query': 'chicken-biryani',
            },
            {
                'name': 'Pasta Alfredo',
                'description': 'Creamy white sauce pasta with herbs',
                'price': Decimal('280.00'),
                'category': 'Main Course',
                'is_available': True,
                'image_query': 'pasta-alfredo',
            },
            {
                'name': 'Margherita Pizza',
                'description': 'Classic pizza with tomato sauce, mozzarella, and basil',
                'price': Decimal('350.00'),
                'category': 'Main Course',
                'is_available': True,
                'image_query': 'margherita-pizza',
            },
            # Breads
            {
                'name': 'Garlic Naan',
                'description': 'Indian bread topped with garlic and butter',
                'price': Decimal('60.00'),
                'category': 'Breads',
                'is_available': True,
                'image_query': 'garlic-naan',
            },
            {
                'name': 'Butter Naan',
                'description': 'Soft Indian bread brushed with butter',
                'price': Decimal('50.00'),
                'category': 'Breads',
                'is_available': True,
                'image_query': 'naan-bread',
            },
            {
                'name': 'Tandoori Roti',
                'description': 'Whole wheat flatbread from tandoor',
                'price': Decimal('40.00'),
                'category': 'Breads',
                'is_available': True,
                'image_query': 'tandoori-roti',
            },
            # Desserts
            {
                'name': 'Gulab Jamun',
                'description': 'Sweet dumplings soaked in rose-flavored syrup',
                'price': Decimal('80.00'),
                'category': 'Desserts',
                'is_available': True,
                'image_query': 'gulab-jamun',
            },
            {
                'name': 'Chocolate Brownie',
                'description': 'Warm chocolate brownie with vanilla ice cream',
                'price': Decimal('150.00'),
                'category': 'Desserts',
                'is_available': True,
                'image_query': 'chocolate-brownie',
            },
            {
                'name': 'Ice Cream Sundae',
                'description': 'Three scoops of ice cream with chocolate sauce',
                'price': Decimal('120.00'),
                'category': 'Desserts',
                'is_available': True,
                'image_query': 'ice-cream-sundae',
            },
            # Beverages
            {
                'name': 'Mango Lassi',
                'description': 'Refreshing yogurt drink with mango pulp',
                'price': Decimal('80.00'),
                'category': 'Beverages',
                'is_available': True,
                'image_query': 'mango-lassi',
            },
            {
                'name': 'Masala Chai',
                'description': 'Indian spiced tea with milk',
                'price': Decimal('40.00'),
                'category': 'Beverages',
                'is_available': True,
                'image_query': 'masala-chai',
            },
            {
                'name': 'Fresh Lime Soda',
                'description': 'Refreshing lime juice with soda',
                'price': Decimal('60.00'),
                'category': 'Beverages',
                'is_available': True,
                'image_query': 'lemonade',
            },
            {
                'name': 'Coca Cola',
                'description': 'Chilled soft drink',
                'price': Decimal('50.00'),
                'category': 'Beverages',
                'is_available': True,
                'image_query': 'coca-cola',
            },
        ]

        menu_items = []
        demo_images_dir = Path(__file__).resolve().parent.parent / 'demo_images'
        
        for item_data in menu_data:
            image_query = item_data.pop('image_query', None)
            item, created = MenuItem.objects.get_or_create(
                name=item_data['name'],
                defaults=item_data
            )
            
            # Handle image attachment
            if image_query:
                filename = f"{item_data['name'].lower().replace(' ', '_').replace('(', '').replace(')', '')}.webp"
                image_path = demo_images_dir / filename
                
                # Attach image to menu item if available and item has no image
                if image_path.exists() and not item.image:
                    with open(image_path, 'rb') as img_file:
                        item.image.save(filename, File(img_file), save=True)
                    self.stdout.write(f'  → Attached image to {item.name}')
                elif not image_path.exists():
                    self.stdout.write(self.style.WARNING(f'  ✗ Image not found: {filename}'))
            
            menu_items.append(item)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(menu_items)} menu items'))

        # Create sample orders
        self.stdout.write('Creating sample orders...')
        order_statuses = ['pending', 'preparing', 'ready', 'delivered', 'completed']
        payment_methods = ['cash', 'upi', 'card']
        
        orders_created = 0
        # Create ~10 orders per user
        for user in users:
            num_orders = random.randint(8, 12)
            for _ in range(num_orders):
                table = random.choice(tables)
                status = random.choice(order_statuses)
                payment_method = random.choice(payment_methods)
                
                # Create order
                order = Order.objects.create(
                    user=user,
                    table=table,
                    status=status,
                    payment_method=payment_method,
                    payment_status=status == 'completed',
                    special_instructions=random.choice([
                        '',
                        'Extra spicy please',
                        'No onions',
                        'Less oil',
                        'Pack separately',
                    ])
                )
                
                # Add 2-5 random items to each order
                num_items = random.randint(2, 5)
                selected_items = random.sample(menu_items, num_items)
                total = Decimal('0.00')
                
                for menu_item in selected_items:
                    quantity = random.randint(1, 3)
                    OrderItem.objects.create(
                        order=order,
                        menu_item=menu_item,
                        quantity=quantity,
                        price_at_order=menu_item.price,
                        special_instructions=random.choice(['', 'Extra sauce', 'Less spicy'])
                    )
                    total += menu_item.price * quantity
                
                order.total_amount = total
                order.save()
                orders_created += 1

        self.stdout.write(self.style.SUCCESS(f'✓ Created {orders_created} sample orders'))
        
        self.stdout.write(self.style.SUCCESS('\n✅ Database populated successfully!'))
        self.stdout.write(self.style.SUCCESS(f'\nSummary:'))
        self.stdout.write(f'  • Users: {User.objects.count()}')
        self.stdout.write(f'  • Tables: {Table.objects.count()}')
        self.stdout.write(f'  • Menu Items: {MenuItem.objects.count()}')
        self.stdout.write(f'  • Orders: {Order.objects.count()}')
        self.stdout.write(f'  • Order Items: {OrderItem.objects.count()}')
        self.stdout.write(self.style.SUCCESS(f'\nTest credentials:'))
        self.stdout.write(f'  Username: <any 10-digit phone number from users above>')
        self.stdout.write(f'  Password: 123123')
