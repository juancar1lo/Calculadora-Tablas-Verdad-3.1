document.addEventListener('DOMContentLoaded', function() {
  const inputExpresion = document.getElementById('expresion');

  // Función para agregar caracteres al campo de expresión
  function appendToExpression(value) {
    inputExpresion.value += value;
  }

  // Eventos de los botones para insertar variables y operadores
  document.getElementById('btnP').addEventListener('click', () => appendToExpression('p'));
  document.getElementById('btnQ').addEventListener('click', () => appendToExpression('q'));
  document.getElementById('btnR').addEventListener('click', () => appendToExpression('r'));
  document.getElementById('btnS').addEventListener('click', () => appendToExpression('s'));
  document.getElementById('btnT').addEventListener('click', () => appendToExpression('t'));

  document.getElementById('btnAnd').addEventListener('click', () => appendToExpression('∧'));
  document.getElementById('btnOr').addEventListener('click', () => appendToExpression('∨'));
  document.getElementById('btnNot').addEventListener('click', () => appendToExpression('¬'));
  document.getElementById('btnConditional').addEventListener('click', () => appendToExpression('→'));
  document.getElementById('btnBiconditional').addEventListener('click', () => appendToExpression('↔'));
  document.getElementById('btnOpenParen').addEventListener('click', () => appendToExpression('('));
  document.getElementById('btnCloseParen').addEventListener('click', () => appendToExpression(')'));

  // Botón para limpiar la expresión y el resultado
  document.getElementById('btnLimpiar').addEventListener('click', function() {
    inputExpresion.value = "";
    document.getElementById('resultadoTabla').innerHTML = "";
  });

  // -------------------------------------------------------------------
  // 1) Separar la expresión en tokens (cada variable, operador o paréntesis)
  // -------------------------------------------------------------------
  function splitExpression(expr) {
    expr = expr.replace(/\s+/g, '');
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/[pqrst]/.test(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }
      if (ch === '¬' || ch === '∧' || ch === '∨' || ch === '(' || ch === ')') {
        tokens.push(ch);
        i++;
        continue;
      }
      if (ch === '→' || ch === '↔') {
        tokens.push(ch);
        i++;
        continue;
      }
      i++;
    }
    return tokens;
  }

  // -------------------------------------------------------------------
  // 2) Funciones de operadores: precedencia, asociatividad y aplicación
  // -------------------------------------------------------------------
  function precedence(op) {
    switch (op) {
      case '¬': return 5;  // unario
      case '∧': return 4;
      case '∨': return 3;
      case '→': return 2;  // se tratará como right-associative
      case '↔': return 1;
      default:  return 0;
    }
  }

  // Solo ∧, ∨ y ↔ se tratan como left-associative; → se considera right-associative
  function isLeftAssociative(op) {
    return (op === '∧' || op === '∨' || op === '↔');
  }

  function isUnary(op) {
    return (op === '¬');
  }

  function isBinary(op) {
    return (op === '∧' || op === '∨' || op === '→' || op === '↔');
  }

  // Aplica el operador dado (los operandos son booleanos)
  function applyOperator(op, left, right) {
    switch (op) {
      case '¬': return !left;
      case '∧': return left && right;
      case '∨': return left || right;
      case '→': return (!left) || right;
      case '↔': return left === right;
      default:   return false;
    }
  }

  // -------------------------------------------------------------------
  // 3) Evaluar una fila (para una asignación de variables) en orden infijo,
  // registrando en cada posición el valor parcial de cada token.
  // Además, se añade una columna extra "Final" con el resultado global.
  // -------------------------------------------------------------------
  function evaluateRowInfix(tokens, values) {
    const opStack = [];      // pila de operadores
    const valStack = [];     // pila de valores booleanos
    const resultByIndex = []; // valores parciales, índice por índice

    function popAndApply() {
      const opObj = opStack.pop();
      const op = opObj.op;
      if (isUnary(op)) {
        const val = valStack.pop();
        const res = applyOperator(op, val, null);
        valStack.push(res);
        resultByIndex[opObj.tokenIndex] = res ? 1 : 0;
      } else {
        const right = valStack.pop();
        const left  = valStack.pop();
        const res = applyOperator(op, left, right);
        valStack.push(res);
        resultByIndex[opObj.tokenIndex] = res ? 1 : 0;
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      let tk = tokens[i];
      if (/[pqrst]/.test(tk)) {
        let boolVal = !!values[tk];
        valStack.push(boolVal);
        resultByIndex[i] = boolVal ? 1 : 0;
      } else if (tk === '(') {
        opStack.push({ op: tk, tokenIndex: i });
        resultByIndex[i] = '';
      } else if (tk === ')') {
        while (opStack.length > 0 && opStack[opStack.length - 1].op !== '(') {
          popAndApply();
        }
        if (opStack.length > 0 && opStack[opStack.length - 1].op === '(') {
          opStack.pop();
        }
        resultByIndex[i] = '';
      } else if (isUnary(tk)) {
        opStack.push({ op: tk, tokenIndex: i });
        resultByIndex[i] = '';
      } else if (isBinary(tk)) {
        const currentOpPrec = precedence(tk);
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1].op !== '('
        ) {
          const topOp = opStack[opStack.length - 1];
          const topPrec = precedence(topOp.op);
          if ((topPrec > currentOpPrec) ||
              (topPrec === currentOpPrec && isLeftAssociative(topOp.op))) {
            popAndApply();
          } else {
            break;
          }
        }
        opStack.push({ op: tk, tokenIndex: i });
        resultByIndex[i] = '';
      } else {
        resultByIndex[i] = '';
      }
    }

    while (opStack.length > 0) {
      const top = opStack.pop();
      if (top.op === '(' || top.op === ')') continue;
      opStack.push({ op: top.op, tokenIndex: top.tokenIndex });
      popAndApply();
    }
    // Extraemos el resultado final (de la pila de valores)
    let finalResult = valStack.length > 0 ? (valStack[0] ? 1 : 0) : '';
    // Agregamos una columna extra para el resultado global
    resultByIndex.push(finalResult);
    return { partials: resultByIndex, final: finalResult };
  }

  // -------------------------------------------------------------------
  // 4) Generar la tabla de verdad completa
  // Se crean todas las combinaciones de asignaciones, se evalúa cada fila
  // y se determina el veredicto global según los resultados finales.
  // -------------------------------------------------------------------
  function generateTruthTable(expression) {
    const tokens = splitExpression(expression);
    if (tokens.length === 0) return null;
    
    // Creamos un arreglo para el encabezado que incluye los tokens y una columna "Final"
    const tokensWithFinal = tokens.slice();
    tokensWithFinal.push("Final");

    // Identificamos las variables presentes
    let varsSet = new Set();
    tokens.forEach(t => {
      if (/[pqrst]/.test(t)) {
        varsSet.add(t);
      }
    });
    let vars = Array.from(varsSet);
    vars.sort();

    let numRows = Math.pow(2, vars.length);
    let rows = [];
    let finalResults = [];

    for (let i = 0; i < numRows; i++) {
      let assignment = {};
      for (let j = 0; j < vars.length; j++) {
        let bit = (i >> (vars.length - 1 - j)) & 1;
        assignment[vars[j]] = (bit === 1);
      }
      let evaluation = evaluateRowInfix(tokens, assignment);
      let partials = evaluation.partials;
      let final = evaluation.final;
      finalResults.push(final);
      rows.push({ assignment, partials });
    }

    let uniqueVals = new Set(finalResults);
    let verdict = '';
    if (uniqueVals.size === 1) {
      verdict = uniqueVals.has(1) ? 'Tautología' : 'Contradicción';
    } else {
      verdict = 'Indeterminación';
    }

    return {
      tokens: tokensWithFinal,
      vars,
      rows,
      verdict
    };
  }

  // -------------------------------------------------------------------
  // 5) Renderizar la tabla en HTML
  // La primera fila muestra cada token (más la columna "Final") y en las filas siguientes se muestran los valores parciales.
  // -------------------------------------------------------------------
  function renderTruthTable(tableData) {
    if (!tableData) {
      return '<p style="color:red">Expresión inválida o vacía.</p>';
    }
    const { tokens, rows, verdict } = tableData;
    let html = '<table style="margin:auto; border-collapse:collapse;">';
    html += '<thead><tr>';
    tokens.forEach(tk => {
      html += `<th style="border:1px solid black; padding:4px;">${tk}</th>`;
    });
    html += '</tr></thead>';
    html += '<tbody>';
    rows.forEach(row => {
      const partials = row.partials;
      html += '<tr>';
      for (let i = 0; i < tokens.length; i++) {
        let cellVal = partials[i] !== undefined ? partials[i] : '';
        html += `<td style="border:1px solid black; padding:4px;">${cellVal}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<p><strong>Resultado: ${verdict}</strong></p>`;
    return html;
  }

  // -------------------------------------------------------------------
  // 6) Manejo del envío del formulario
  // -------------------------------------------------------------------
  document.getElementById('tablaVerdadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const expression = inputExpresion.value;
    const tableData = generateTruthTable(expression);
    const tableHTML = renderTruthTable(tableData);
    document.getElementById('resultadoTabla').innerHTML = tableHTML;
  });
});
