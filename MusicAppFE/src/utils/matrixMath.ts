export function createMatrix(rows: number, cols: number, fill = 0): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) {
    m.push(new Array(cols).fill(fill));
  }
  return m;
}

export function transposeMatrix(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const t = createMatrix(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      t[j][i] = m[i][j];
    }
  }
  return t;
}

export function multiplyMatrix(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const rowsB = b.length;
  const colsB = b[0].length;

  if (colsA !== rowsB) {
    throw new Error('Incompatible matrices for multiplication');
  }

  const result = createMatrix(rowsA, colsB);
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

export function addMatrix(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = a[0].length;
  const result = createMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = a[i][j] + b[i][j];
    }
  }
  return result;
}

export function multiplyMatrixScalar(m: number[][], scalar: number): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const result = createMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = m[i][j] * scalar;
    }
  }
  return result;
}

export function multiplyMatrixVector(m: number[][], v: number[]): number[] {
  const rows = m.length;
  const cols = m[0].length;
  if (cols !== v.length) {
    throw new Error('Incompatible matrix and vector');
  }

  const result = new Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i] += m[i][j] * v[j];
    }
  }
  return result;
}

export function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  const aug = createMatrix(n, 2 * n);

  // Create augmented matrix [A | I]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      aug[i][j] = A[i][j];
    }
    aug[i][n + i] = 1;
  }

  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(aug[j][i]) > Math.abs(aug[pivot][i])) {
        pivot = j;
      }
    }

    // Swap rows
    const temp = aug[i];
    aug[i] = aug[pivot];
    aug[pivot] = temp;

    const pivotVal = aug[i][i];
    if (Math.abs(pivotVal) < 1e-9) {
      throw new Error('Matrix is singular or nearly singular');
    }

    // Normalize row
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivotVal;
    }

    // Eliminate other rows
    for (let j = 0; j < n; j++) {
      if (j !== i) {
        const factor = aug[j][i];
        for (let k = 0; k < 2 * n; k++) {
          aug[j][k] -= factor * aug[i][k];
        }
      }
    }
  }

  // Extract inverse
  const inv = createMatrix(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inv[i][j] = aug[i][n + j];
    }
  }
  return inv;
}
