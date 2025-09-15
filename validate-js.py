#!/usr/bin/env python3
"""
JavaScript Code Quality Validator for IT Inventory App
Prevents common JavaScript errors like duplicate declarations, syntax issues, etc.
"""

import re
import sys
import os
from collections import defaultdict

def check_duplicate_declarations(content, filename):
    """Check for duplicate function/variable declarations in same scope"""
    errors = []
    
    # Find all function/block scopes by tracking braces
    lines = content.split('\n')
    scope_stack = []
    declarations_by_scope = defaultdict(lambda: defaultdict(list))
    
    for line_num, line in enumerate(lines, 1):
        # Track scope depth by counting braces
        open_braces = line.count('{')
        close_braces = line.count('}')
        
        # Check for function/variable declarations
        function_pattern = r'(?:const|let|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)'
        match = re.search(function_pattern, line)
        
        if match:
            name = match.group(1)
            current_scope = len(scope_stack)
            declarations_by_scope[current_scope][name].append(line_num)
        
        # Update scope stack
        scope_stack.extend(['{'] * open_braces)
        for _ in range(close_braces):
            if scope_stack:
                scope_stack.pop()
    
    # Report duplicates within same scope only
    for scope_level, declarations in declarations_by_scope.items():
        for name, lines in declarations.items():
            if len(lines) > 1:
                # Only report if it's a true duplicate (not common variable names in different functions)
                if name not in ['response', 'data', 'item', 'result', 'value', 'i', 'key', 'row']:
                    errors.append(f"Same-scope duplicate '{name}' at lines: {', '.join(map(str, lines))}")
    
    return errors

def check_unclosed_braces(content, filename):
    """Check for unclosed braces, brackets, parentheses"""
    errors = []
    
    stack = []
    pairs = {'(': ')', '[': ']', '{': '}'}
    closing = {v: k for k, v in pairs.items()}
    
    for i, char in enumerate(content):
        line_num = content[:i].count('\n') + 1
        
        if char in pairs:
            stack.append((char, line_num))
        elif char in closing:
            if not stack:
                errors.append(f"Unexpected closing '{char}' at line {line_num}")
            else:
                opener, opener_line = stack.pop()
                if pairs[opener] != char:
                    errors.append(f"Mismatched braces: '{opener}' at line {opener_line}, '{char}' at line {line_num}")
    
    # Check for unclosed openers
    for opener, line_num in stack:
        errors.append(f"Unclosed '{opener}' at line {line_num}")
    
    return errors

def check_console_logs(content, filename):
    """Check for console.log statements that should be removed in production"""
    warnings = []
    
    console_pattern = r'console\.(log|debug|info)\s*\('
    matches = re.finditer(console_pattern, content)
    
    for match in matches:
        line_num = content[:match.start()].count('\n') + 1
        warnings.append(f"Console statement at line {line_num}: {match.group(0)}...")
    
    return warnings

def check_unused_variables(content, filename):
    """Basic check for potentially unused variables (simple heuristic)"""
    warnings = []
    
    # Find variable declarations
    var_pattern = r'(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)'
    declarations = {}
    
    for match in re.finditer(var_pattern, content):
        var_name = match.group(1)
        line_num = content[:match.start()].count('\n') + 1
        declarations[var_name] = line_num
    
    # Check if variables are used (simple string search)
    for var_name, line_num in declarations.items():
        # Count occurrences (excluding the declaration itself)
        occurrences = len(re.findall(rf'\b{re.escape(var_name)}\b', content))
        if occurrences <= 1:  # Only the declaration
            warnings.append(f"Potentially unused variable '{var_name}' at line {line_num}")
    
    return warnings

def check_security_issues(content, filename):
    """Check for common security issues"""
    warnings = []
    
    # Check for eval usage
    if 'eval(' in content:
        warnings.append("Security warning: eval() usage detected")
    
    # Check for innerHTML usage
    innerHTML_pattern = r'\.innerHTML\s*='
    if re.search(innerHTML_pattern, content):
        warnings.append("Security warning: innerHTML usage detected (consider using textContent)")
    
    # Check for document.write
    if 'document.write' in content:
        warnings.append("Security warning: document.write usage detected")
    
    return warnings

def check_react_hook_imports(content, filename):
    """Check for missing React hook imports"""
    errors = []
    
    # Find React hooks import line
    import_pattern = r'const\s*\{\s*([^}]+)\s*\}\s*=\s*React'
    import_match = re.search(import_pattern, content)
    
    if not import_match:
        errors.append("React hooks import statement not found")
        return errors
    
    # Extract imported hooks
    imported_hooks = set()
    imports_str = import_match.group(1)
    for hook in imports_str.split(','):
        hook = hook.strip()
        if hook.startswith('use'):
            imported_hooks.add(hook)
    
    # Find all React hooks used in the code
    hook_pattern = r'\b(use[A-Z][a-zA-Z]*)\s*\('
    used_hooks = set()
    
    # Standard React hooks that need to be imported
    standard_hooks = {'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useContext', 'useReducer'}
    
    for match in re.finditer(hook_pattern, content):
        hook_name = match.group(1)
        if hook_name in standard_hooks:
            used_hooks.add(hook_name)
    
    # Check for missing imports
    missing_hooks = used_hooks - imported_hooks
    
    for hook in missing_hooks:
        line_nums = []
        for match in re.finditer(rf'\b{re.escape(hook)}\s*\(', content):
            line_num = content[:match.start()].count('\n') + 1
            line_nums.append(str(line_num))
        errors.append(f"Missing React hook import: '{hook}' used at lines {', '.join(line_nums)} but not imported")
    
    return errors

def check_infinite_render_loops(content, filename):
    """Check for potential infinite render loops in React useEffect hooks"""
    errors = []
    warnings = []
    
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Find useEffect without dependency array
        if 'useEffect(' in line and not line.strip().startswith('//'):
            # Look for the closing of this useEffect in subsequent lines
            brace_count = 0
            effect_content = []
            effect_start = i
            
            for j in range(i, min(i + 50, len(lines))):  # Look ahead max 50 lines
                current_line = lines[j]
                effect_content.append(current_line)
                
                # Count braces to find the end of useEffect
                brace_count += current_line.count('{') - current_line.count('}')
                
                # Check if this line closes the useEffect
                if j > i and brace_count == 0:
                    effect_block = '\n'.join(effect_content)
                    
                    # Check if useEffect has no dependency array (ends with });)
                    if re.search(r'\}\);\s*$', current_line.strip()):
                        # Check if it contains setState calls
                        if re.search(r'set[A-Z][a-zA-Z]*\s*\(', effect_block):
                            errors.append(f"Potential infinite render loop: useEffect at line {line_num} has no dependency array but calls setState")
                    
                    # Check for empty dependency array with setState
                    elif re.search(r'\}\),\s*\[\s*\]\s*\);\s*$', current_line.strip()):
                        if re.search(r'set[A-Z][a-zA-Z]*\s*\(', effect_block):
                            warnings.append(f"useEffect at line {line_num} has empty dependency array but calls setState - may cause stale closures")
                    
                    break
    
    return errors, warnings

def validate_file(filepath):
    """Validate a JavaScript file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return False
    
    print(f"\n🔍 Validating {filepath}...")
    
    errors = []
    warnings = []
    
    # Run all checks
    errors.extend(check_duplicate_declarations(content, filepath))
    errors.extend(check_unclosed_braces(content, filepath))
    errors.extend(check_react_hook_imports(content, filepath))
    
    # Check for infinite render loops
    render_loop_errors, render_loop_warnings = check_infinite_render_loops(content, filepath)
    errors.extend(render_loop_errors)
    warnings.extend(render_loop_warnings)
    
    warnings.extend(check_console_logs(content, filepath))
    warnings.extend(check_unused_variables(content, filepath))
    warnings.extend(check_security_issues(content, filepath))
    
    # Report results
    if errors:
        print("❌ ERRORS FOUND:")
        for error in errors:
            print(f"  • {error}")
    
    if warnings:
        print("⚠️  WARNINGS:")
        for warning in warnings[:10]:  # Limit to first 10 warnings
            print(f"  • {warning}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more warnings")
    
    if not errors and not warnings:
        print("✅ No issues found!")
    
    return len(errors) == 0

def main():
    """Main validation function"""
    print("🛡️  JavaScript Code Quality Validator")
    print("=" * 40)
    
    # Files to validate
    files_to_check = [
        '/home/eganuser/it-inventory-app/index.html'
    ]
    
    all_passed = True
    
    for filepath in files_to_check:
        if os.path.exists(filepath):
            passed = validate_file(filepath)
            all_passed = all_passed and passed
        else:
            print(f"⚠️  File not found: {filepath}")
    
    print(f"\n{'🎉 ALL VALIDATIONS PASSED!' if all_passed else '🚨 VALIDATION FAILED!'}")
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())