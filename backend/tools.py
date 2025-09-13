import ast
import operator as op

# allowed operators for safe evaluate
_allowed_ops = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
    ast.Pow: op.pow,
    ast.Mod: op.mod,
    ast.USub: op.neg,
}

def safe_eval(expr: str):
    """
    Safely evaluate arithmetic expressions containing numbers and + - * / ** % ( ).
    Raises ValueError for invalid expressions.
    """
    def _eval(node):
        if isinstance(node, ast.Constant):  
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError("Only numbers allowed")
        elif isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in _allowed_ops:
                raise ValueError("Operator not allowed")
            return _allowed_ops[op_type](_eval(node.left), _eval(node.right))
        elif isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type not in _allowed_ops:
                raise ValueError("Operator not allowed")
            return _allowed_ops[op_type](_eval(node.operand))
        else:
            raise ValueError("Expression not allowed")

    parsed = ast.parse(expr, mode='eval').body
    return _eval(parsed)
