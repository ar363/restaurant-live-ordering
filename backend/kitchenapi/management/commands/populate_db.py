from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.core.files import File
from django.conf import settings
from kitchenapi.models import Table, MenuItem, Order, OrderItem
from decimal import Decimal
from pathlib import Path
import random


class Command(BaseCommand):
    help = 'Populate the database with sample data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before populating',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing data...'))
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            MenuItem.objects.all().delete()
            Table.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('✓ Cleared existing data'))

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
        demo_images_dir = settings.BASE_DIR / 'kitchenapi' / 'management' / 'demo_images'
        
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
                
                # Attach image if the source exists and file is missing from disk
                if image_path.exists() and (not item.image or not Path(settings.MEDIA_ROOT / item.image.name).exists()):
                    with open(image_path, 'rb') as img_file:
                        item.image.save(filename, File(img_file), save=True)
                    self.stdout.write(f'  → Attached image to {item.name}')
                elif not image_path.exists():
                    self.stdout.write(self.style.WARNING(f'  ✗ Image not found: {filename}'))
            
            menu_items.append(item)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(menu_items)} menu items'))

        # Create kitchen superuser
        self.stdout.write('Creating kitchen superuser...')
        kitchen_user, created = User.objects.get_or_create(
            username='kitchen',
            defaults={
                'email': 'kitchen@restaurant.local',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            kitchen_user.set_password('kitchen')
            kitchen_user.save()
            self.stdout.write(self.style.SUCCESS('✓ Created kitchen superuser'))
        else:
            self.stdout.write(self.style.SUCCESS('✓ Kitchen superuser already exists'))
        
        self.stdout.write(self.style.SUCCESS('\\n✅ Database seeded successfully!'))
        self.stdout.write(self.style.SUCCESS(f'\\nData created:'))
        self.stdout.write(f'  • Tables: {Table.objects.count()}')
        self.stdout.write(f'  • Menu Items: {MenuItem.objects.count()}')
        self.stdout.write(self.style.SUCCESS(f'\\nDefault credentials:'))
        self.stdout.write(f'  🔐 Kitchen Dashboard:')
        self.stdout.write(f'     Username: kitchen')
        self.stdout.write(f'     Password: kitchen')
