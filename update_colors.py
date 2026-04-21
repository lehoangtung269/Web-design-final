import os
import re

FILES = [
    'views/fields/detail.ejs',
    'views/bookings/checkout.ejs',
    'views/bookings/confirmation.ejs',
    'views/bookings/history.ejs'
]

REPLACEMENTS = [
    (r'bg-emerald-500', 'bg-primary'),
    (r'text-emerald-500', 'text-primary'),
    (r'border-emerald-500', 'border-primary'),
    (r'ring-emerald-500', 'ring-primary'),
    
    (r'bg-emerald-600', 'bg-primary'),
    (r'text-emerald-600', 'text-primary'),
    (r'border-emerald-600', 'border-primary'),
    
    (r'bg-emerald-700', 'bg-on-surface'),
    (r'text-emerald-700', 'text-on-surface'),
    
    (r'bg-emerald-50', 'bg-surface-container-low'),
    (r'text-emerald-800', 'text-primary'),

    (r'border-emerald-100', 'border-outline-variant'),
    (r'bg-emerald-100', 'bg-outline-variant'),
    
    (r'border-emerald-200', 'border-outline-variant'),
    (r'shadow-emerald-200', 'shadow-ambient'),

    (r'bg-sky-500', 'bg-primary'),
    (r'text-sky-600', 'text-primary'),
    (r'bg-sky-50 ', 'bg-surface-container-low '),

    (r'bg-orange-500', 'bg-primary'),
    (r'text-orange-600', 'text-primary'),
    
    (r'text-slate-500 text-sm flex items-center', 'kinetic-label text-on-surface-variant flex items-center'),
    (r'text-xs font-bold text-slate-500 uppercase tracking-widest', 'kinetic-label text-on-surface-variant'),
    (r'text-on-surface-variant text-sm', 'kinetic-label text-on-surface-variant'),

    (r'#10b981', '#6a37d3'), # Emerald 500 -> Primary Purple
    (r'#059669', '#6a37d3'), # Emerald 600 -> Primary Purple
    (r'#047857', '#0b1c30'), # Focus Emerald -> Obsidian On-Surface
    (r'#064e3b', '#0b1c30'), # Dark Emerald 1 -> Obsidian
    (r'#065f46', '#ae8dff'), # Dark Emerald 2 -> Primary Container
    (r'#d1fae5', '#ebf1ff'), # Light Emerald -> surface-container-low
    (r'#f0fdf4', '#ffffff'), # Lightest Emerald -> surface-lowest
]

for file_path in FILES:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for old, new in REPLACEMENTS:
            content = re.sub(old, new, content)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file_path}")
