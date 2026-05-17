#!/usr/bin/env python3
"""
Transform HeroUI v2 Tooltip to v3 compound pattern.

Old: <Tooltip content="text" [placement="..."] [closeDelay={...}]>
       {children}
     </Tooltip>

New: <Tooltip [closeDelay={...}]>
       <Tooltip.Trigger>{children}</Tooltip.Trigger>
       <Tooltip.Content [placement="..."]>text</Tooltip.Content>
     </Tooltip>
"""

import re
import sys


def extract_attribute(text, attr_name):
    """Extract attribute value from a string of JSX props. Returns (value_str, remaining_text)."""
    # Match: attr="value" or attr={"value"} or attr={expr} or attr={`...`}
    # Simple string: attr="..." or attr='...'
    pattern_string = rf'{attr_name}="([^"]*)"'
    m = re.search(pattern_string, text)
    if m:
        return m.group(1), text[:m.start()] + text[m.end():]
    
    pattern_string2 = rf"{attr_name}='([^']*)'"
    m = re.search(pattern_string2, text)
    if m:
        return m.group(1), text[:m.start()] + text[m.end():]
    
    # Expression: attr={...} - need to handle balanced braces
    pattern_expr = rf'{attr_name}={{'
    idx = text.find(attr_name + '={')
    if idx != -1:
        brace_start = idx + len(attr_name) + 1
        depth = 0
        i = brace_start
        while i < len(text):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    expr_val = text[brace_start+1:i]  # content between { }
                    remaining = text[:idx] + text[i+1:]
                    return '{' + expr_val + '}', remaining
            i += 1
    
    return None, text


def transform_tooltip(content):
    """Transform all <Tooltip content="..."> patterns in content."""
    
    result = []
    i = 0
    
    while i < len(content):
        # Look for <Tooltip 
        match = re.search(r'<Tooltip\s', content[i:])
        if not match:
            result.append(content[i:])
            break
        
        tooltip_start = i + match.start()
        result.append(content[i:tooltip_start])
        
        # Find the end of the opening <Tooltip ...> tag
        # Need to handle balanced < > considering JSX
        tag_content_start = tooltip_start + len('<Tooltip')
        
        # Find the '>' that ends the opening tag (not inside {})
        j = tag_content_start
        depth_brace = 0
        depth_angle = 0
        while j < len(content):
            c = content[j]
            if c == '{':
                depth_brace += 1
            elif c == '}':
                depth_brace -= 1
            elif depth_brace == 0:
                if c == '>':
                    break
            j += 1
        
        tag_end = j + 1  # position after '>'
        opening_tag = content[tooltip_start:tag_end]
        
        # Check if it has a content prop
        content_val, remaining_props = extract_attribute(opening_tag[len('<Tooltip'):].rstrip('>'), 'content')
        
        if content_val is None:
            # No content prop, skip this tooltip
            result.append(opening_tag)
            i = tag_end
            continue
        
        # Also extract placement to put on Tooltip.Content
        placement_val, remaining_props = extract_attribute(remaining_props, 'placement')
        
        # Also extract offset 
        offset_val, remaining_props = extract_attribute(remaining_props, 'offset')
        
        # Remaining props stay on Tooltip root (like closeDelay, delay)
        # Clean up extra whitespace
        remaining_props = re.sub(r'\s+', ' ', remaining_props).strip()
        
        # Find the closing </Tooltip>
        closing = '</Tooltip>'
        close_idx = find_closing_tooltip(content, tag_end)
        if close_idx == -1:
            result.append(opening_tag)
            i = tag_end
            continue
        
        # Extract children
        children = content[tag_end:close_idx].strip()
        
        # Determine indentation from the original <Tooltip line
        line_start = content.rfind('\n', 0, tooltip_start) + 1
        indent = ''
        for ch in content[line_start:tooltip_start]:
            if ch in ' \t':
                indent += ch
            else:
                break
        
        inner_indent = indent + '  '
        
        # Build content prop for Tooltip.Content
        if content_val.startswith('{') and content_val.endswith('}'):
            # It was an expression like {someVar}
            tooltip_content_children = content_val[1:-1]
            tooltip_content_str = f'{{{tooltip_content_children}}}'
        else:
            # It was a string
            tooltip_content_str = content_val
        
        # Build placement on Tooltip.Content
        tc_props = ''
        if placement_val:
            tc_props += f' placement={placement_val!r}' if not placement_val.startswith('{') else f' placement={placement_val}'
        if offset_val:
            tc_props += f' offset={offset_val}' if offset_val.startswith('{') else f' offset="{offset_val}"'
        
        # Build new Tooltip root props
        root_props = ''
        if remaining_props:
            root_props = ' ' + remaining_props
        
        # Build the new structure
        new_tooltip = f'''<Tooltip{root_props}>
{inner_indent}<Tooltip.Trigger>
{inner_indent}  {children}
{inner_indent}</Tooltip.Trigger>
{inner_indent}<Tooltip.Content{tc_props}>
{inner_indent}  {tooltip_content_str}
{inner_indent}</Tooltip.Content>
{indent}</Tooltip>'''
        
        result.append(new_tooltip)
        i = close_idx + len(closing)
    
    return ''.join(result)


def find_closing_tooltip(text, start):
    """Find closing </Tooltip> tag, handling nested tooltips."""
    depth = 0
    i = start
    while i < len(text):
        if text[i:i+9] == '<Tooltip ' or text[i:i+9] == '<Tooltip>':
            depth += 1
            i += 9
        elif text[i:i+10] == '</Tooltip>':
            if depth == 0:
                return i
            depth -= 1
            i += 10
        else:
            i += 1
    return -1


FILES = [
    'src/components/markdown-editor.tsx',
    'src/components/tournament-list.tsx',
    'src/components/winner-form.tsx',
    'src/components/membership/DirectoryHeader.tsx',
    'src/components/membership/MemberRow.tsx',
    'src/components/membership/MemberCardMobile.tsx',
    'src/pages/tournament-detail.tsx',
    'src/components/registration-editor.tsx',
    'src/components/registrations-list.tsx',
    'src/components/tournament-breakdown.tsx',
    'src/components/yearly-team-winners.tsx',
]

import os

base = '/Users/coshea/Code/rgc-react'

for rel_path in FILES:
    filepath = os.path.join(base, rel_path)
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'content=' not in content or '<Tooltip' not in content:
        print(f'Skipping {rel_path} - no Tooltip content= found')
        continue
    
    new_content = transform_tooltip(content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f'Fixed: {rel_path}')
    else:
        print(f'No change: {rel_path}')

print('Done!')
