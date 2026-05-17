#!/usr/bin/env python3
"""
Transform startContent/endContent JSX props to inline children.

Handles patterns like:
  <Button startContent={<Icon ... />}>Label</Button>
  → <Button><Icon ... />Label</Button>

  <Button isIconOnly startContent={<Icon ... />} />
  → <Button isIconOnly><Icon ... /></Button>

  <Button startContent={cond && <Icon ... />}>Label</Button>
  → <Button>{cond && <Icon ... />}Label</Button>
"""

import re
import sys
import os
import glob


def extract_braced_expr(text, start):
    """Extract balanced brace expression starting at `start` (the `{`)."""
    assert text[start] == '{'
    depth = 0
    i = start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1], i+1
        i += 1
    return None, -1


def transform_file(content):
    """Main transformation logic."""
    # We'll process line by line, tracking open Button-like elements
    # Strategy: find `startContent={...}` or `endContent={...}` patterns
    # and move them to children.
    
    changed = False
    
    # Pattern 1: single-line startContent on same line as the prop
    # e.g., startContent={<Icon icon="..." className="..." />}
    # or startContent={someVar}
    
    result = list(content)
    text = content
    
    # We'll do multiple passes
    for prop_name in ['startContent', 'endContent']:
        new_text = process_prop(text, prop_name)
        if new_text != text:
            changed = True
            text = new_text
    
    return text, changed


def process_prop(text, prop_name):
    """Remove prop_name={...} from JSX props and move content to children."""
    
    # Find all occurrences of prop_name={...}
    search = prop_name + '={'
    
    result_parts = []
    i = 0
    
    while i < len(text):
        pos = text.find(search, i)
        if pos == -1:
            result_parts.append(text[i:])
            break
        
        # Found propName={
        brace_start = pos + len(prop_name) + 1  # position of '{'
        assert text[brace_start] == '{', f"Expected {{ at {brace_start}, got {text[brace_start]!r}"
        
        # Extract the braced expression
        expr, end_pos = extract_braced_expr(text, brace_start)
        if expr is None:
            # Couldn't parse, skip
            result_parts.append(text[i:pos + len(search)])
            i = pos + len(search)
            continue
        
        # The prop span: from pos to end_pos
        prop_span = text[pos:end_pos]
        inner_expr = expr[1:-1].strip()  # content between { and }
        
        # Find the opening tag this prop belongs to.
        # Look backwards for the '<' of the tag opening
        tag_open_pos = text.rfind('<', 0, pos)
        if tag_open_pos == -1:
            result_parts.append(text[i:end_pos])
            i = end_pos
            continue
        
        # Get tag name
        tag_name_match = re.match(r'<([A-Za-z][A-Za-z0-9.]*)', text[tag_open_pos:])
        if not tag_name_match:
            result_parts.append(text[i:end_pos])
            i = end_pos
            continue
        
        tag_name = tag_name_match.group(1)
        
        # Now find where the opening tag ends (either '/>' for self-closing or '>')
        # We need to find the '>' or '/>' after end_pos that closes this tag's props
        # Search forward from end_pos for the end of the opening tag
        tag_end_pos = find_tag_end(text, end_pos)
        if tag_end_pos == -1:
            result_parts.append(text[i:end_pos])
            i = end_pos
            continue
        
        is_self_closing = text[tag_end_pos - 1] == '/'
        
        # Remove any whitespace before/after the prop in the props section
        # The prop might have leading whitespace on its line
        prop_with_ws_start = pos
        # Look back for whitespace/newline before prop
        ws_start = pos
        while ws_start > tag_open_pos and text[ws_start-1] in ' \t\n':
            ws_start -= 1
        # Keep one space if there's something before
        
        # Build the replacement
        if is_self_closing:
            # Change from self-closing to open+close with child
            # Remove the '/>' and add '>{inner_expr}</TagName>'
            # The prop itself also needs removal
            
            # Text before this prop (from i)
            before_prop = text[i:ws_start]
            after_prop = text[end_pos:tag_end_pos-1]  # up to but not including '/>'
            after_prop = after_prop.rstrip()
            
            if prop_name == 'startContent':
                result_parts.append(before_prop + after_prop)
                result_parts.append(f'>{{{inner_expr}}}</{tag_name}>')
            else:  # endContent
                result_parts.append(before_prop + after_prop)
                result_parts.append(f'>{{{inner_expr}}}</{tag_name}>')
            
            i = tag_end_pos
        else:
            # Open tag - find the closing '>'
            close_gt = text[end_pos:tag_end_pos]
            
            # Get text before the '>' of the opening tag
            # and the children
            # After '>', find the closing tag </TagName>
            children_start = tag_end_pos
            closing_tag = f'</{tag_name}>'
            
            # Find closing tag
            closing_pos = find_closing_tag(text, children_start, tag_name)
            if closing_pos == -1:
                # Can't find closing, just remove the prop
                before_prop = text[i:ws_start]
                after_prop = text[end_pos:]
                result_parts.append(before_prop + after_prop)
                i = len(text)
                continue
            
            children = text[children_start:closing_pos].strip()
            
            # Build new element
            before_prop = text[i:ws_start]
            # props section after the removed prop
            after_props = text[end_pos:tag_end_pos]
            
            if prop_name == 'startContent':
                if children:
                    new_children = f'{{{inner_expr}}}{children}'
                else:
                    new_children = f'{{{inner_expr}}}'
            else:  # endContent
                if children:
                    new_children = f'{children}{{{inner_expr}}}'
                else:
                    new_children = f'{{{inner_expr}}}'
            
            result_parts.append(before_prop + after_props)
            result_parts.append(new_children)
            result_parts.append(f'</{tag_name}>')
            i = closing_pos + len(closing_tag)
    
    return ''.join(result_parts)


def find_tag_end(text, start):
    """Find the position just after the '>' or '/>' that ends an opening tag."""
    i = start
    in_string = None
    depth = 0
    while i < len(text):
        c = text[i]
        if in_string:
            if c == in_string and text[i-1] != '\\':
                in_string = None
        elif c in ('"', "'"):
            in_string = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif depth == 0:
            if c == '>' :
                return i + 1
        i += 1
    return -1


def find_closing_tag(text, start, tag_name):
    """Find the position of the closing </tag_name> starting from start."""
    depth = 0
    i = start
    open_tag = f'<{tag_name}'
    close_tag = f'</{tag_name}>'
    
    while i < len(text):
        if text[i:].startswith(close_tag):
            if depth == 0:
                return i
            depth -= 1
            i += len(close_tag)
        elif text[i:].startswith(open_tag) and (len(text) > i + len(open_tag)) and text[i + len(open_tag)] in ' \t\n>/':
            depth += 1
            i += len(open_tag)
        else:
            i += 1
    return -1


def process_tsx_files(pattern):
    """Process all .tsx files matching pattern."""
    files = glob.glob(pattern, recursive=True)
    total_changed = 0
    
    for filepath in files:
        if '__tests__' in filepath or '__mocks__' in filepath:
            continue
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'startContent' not in content and 'endContent' not in content:
                continue
            
            new_content, changed = transform_file(content)
            
            if changed:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'  Fixed: {filepath}')
                total_changed += 1
        except Exception as e:
            print(f'  Error processing {filepath}: {e}')
    
    print(f'\nTotal files changed: {total_changed}')


if __name__ == '__main__':
    base = '/Users/coshea/Code/rgc-react/src'
    process_tsx_files(os.path.join(base, '**', '*.tsx'))
