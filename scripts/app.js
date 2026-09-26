const canvas0 = document.querySelector('#preview0');
            // const canvas1 = document.querySelector('#preview1');
            const iframe1 = document.querySelector('#pdfiframe1');
            const iframe2 = document.querySelector('#pdfiframe2');
            canvas0.crossOrigin="anonymous";
            // canvas1.crossOrigin="anonymous";
            const ctx0 = canvas0.getContext('2d');
            const ctx1 = canvas0.getContext('2d');

            const PX_TO_MM = 3508 / 297;

            const CANVAS = {
                left: 0,
                top: 0,
                width: canvas0.width,
                height: canvas0.height,
                halfWidth: canvas0.width / 2,
                halfHeight: canvas0.height / 2,
                center: {
                    x: canvas0.width / 2,
                    y: canvas0.height / 2
                }
            };

            let BOARD = null;

            function getCellsPerSide() {
                return Math.max(1, Number(global.config.cellsPerSide ?? global.config.radius));
            }

            // A three-sided hexagon has opposite sides of equal length.  Keeping
            // the dimensions here (rather than treating it as a rectangular grid)
            // also makes the third input meaningful.
            function getHexDepthSides() {
                return {
                    first: Math.max(1, Number(global.config.size.columns) || 1),
                    second: Math.max(1, Number(global.config.size.rows) || 1),
                    third: Math.max(1, Number(global.config.size.third) || 1)
                };
            }

            function getGridSize() {
                if (global.config.sizeMode === 'side') {
                    const cellsPerSide = getCellsPerSide();
                    if (global.config.cellShape === 'square') {
                        return { columns: cellsPerSide, rows: cellsPerSide };
                    }
                    const diameter = cellsPerSide * 2 - 1;
                    return { columns: diameter, rows: diameter };
                }
                if (global.config.cellShape === 'hexagon' && global.config.sizeMode === 'depth') {
                    const { first, second, third } = getHexDepthSides();
                    // Enumerate the same three-sided region for both hexagon
                    // orientations; hexCellMetrics projects it differently.
                    return {
                        columns: second + third - 1,
                        rows: first + second - 1
                    };
                }
                return global.config.size;
            }

            function getGuideGridSize() {
                const columns = Math.max(1, Number(global.config.baseSize.columns) || 1);
                // With a one-side board the UI intentionally exposes just one
                // guide dimension.  Its hidden row value may be left over from
                // a previous two-side configuration, so the guide is square.
                const rows = global.config.sizeMode === 'side'
                    ? columns
                    : Math.max(1, Number(global.config.baseSize.rows) || 1);
                return {
                    columns,
                    rows,
                    third: Math.max(1, Number(global.config.baseSize.third) || 1)
                };
            }

            function getHexGridMetrics(columns, rows) {
                const flatTop = global.config.hexOrientation === 'side';
                const regularHexHeight = 2 / Math.sqrt(3);
                return {
                    horizontalUnits: flatTop
                        ? 0.75 * columns + 0.25
                        : columns + 0.5 * (rows - 1),
                    verticalUnits: flatTop
                        ? rows + 0.5 * (columns - 1)
                        : 0.75 * rows + 0.25,
                    heightRatio: flatTop ? 1 / regularHexHeight : regularHexHeight
                };
            }

            function getHexDepthContentBounds(cellWidth, cellHeight) {
                if (global.config.cellShape !== 'hexagon' || !['side', 'depth'].includes(global.config.sizeMode)) {
                    return null;
                }
                const { columns, rows } = getGridSize();
                const flatTop = global.config.hexOrientation === 'side';
                const horizontalUnits = flatTop
                    ? 0.75 * columns + 0.25
                    : columns + 0.5 * (rows - 1);
                const verticalUnits = flatTop
                    ? rows + 0.5 * (columns - 1)
                    : 0.75 * rows + 0.25;
                // Supplying dimensions lets updateBoard measure the real shape
                // before it decides how large the board can be.  Without this,
                // especially uneven three-sided boards could exceed the paper.
                cellWidth ??= BOARD.size.width / horizontalUnits;
                cellHeight ??= BOARD.size.height / verticalUnits;
                const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };

                for (let outerAxis = 0; outerAxis < rows; outerAxis++) {
                    let count;
                    let start;
                    let axialOuter;
                    if (global.config.sizeMode === 'depth') {
                        const { first, second, third } = getHexDepthSides();
                        count = outerAxis < first
                            ? third + Math.min(outerAxis, second - 1)
                            : third + second - 1 - (outerAxis - first + 1);
                        start = Math.max(0, first - 1 - outerAxis);
                        axialOuter = outerAxis;
                    } else {
                        const cellsPerSide = getCellsPerSide();
                        axialOuter = outerAxis - (cellsPerSide - 1);
                        count = cellsPerSide + Math.min(outerAxis, rows - 1 - outerAxis);
                        start = Math.max(-cellsPerSide + 1, -axialOuter - cellsPerSide + 1);
                    }
                    for (let innerIndex = 0; innerIndex < count; innerIndex++) {
                        const innerAxis = start + innerIndex;
                        const left = (global.config.sizeMode === 'depth'
                            ? (flatTop ? outerAxis * 0.75 : innerAxis + outerAxis * 0.5)
                            : (flatTop ? innerAxis * 0.75 : innerAxis + axialOuter * 0.5)
                        ) * cellWidth;
                        const top = (global.config.sizeMode === 'depth'
                            ? (flatTop ? innerAxis + outerAxis * 0.5 : outerAxis * 0.75)
                            : (flatTop ? axialOuter + innerAxis * 0.5 : axialOuter * 0.75)
                        ) * cellHeight;
                        bounds.left = Math.min(bounds.left, left);
                        bounds.top = Math.min(bounds.top, top);
                        bounds.right = Math.max(bounds.right, left + cellWidth);
                        bounds.bottom = Math.max(bounds.bottom, top + cellHeight);
                    }
                }
                return bounds;
            }

            function updateBoard() {
                const { columns, rows } = getGridSize();
                const guideSize = getGuideGridSize();
                BOARD = {
                    ratio: columns / rows,
                    baseRatio: guideSize.columns / guideSize.rows,
                    margin: {
                        x: Math.round(CONFIG_MARGIN_X * PX_TO_MM),
                        y: Math.round(CONFIG_MARGIN_Y * PX_TO_MM),
                    }
                };
                Object.assign(BOARD, {
                    baseSize: {
                        width: CANVAS.width - BOARD.margin.x * 2,
                        height: CANVAS.height - BOARD.margin.y * 2
                    }
                });
                if (global.config.sameSize === 'cover') {
                    Object.assign(BOARD, {
                        size: {
                            width: BOARD.baseSize.width,
                            height: BOARD.baseSize.height
                        }
                    });
                } else if (global.config.sameSize === 'contain') {
                    Object.assign(BOARD, {
                        size: {
                            width: BOARD.baseSize.width / Math.max(columns, rows) * columns,
                            height: BOARD.baseSize.height / Math.max(columns, rows) * rows
                        }
                    });
                } else if (global.config.sameSize === 'diff') {
                    // The guide defines a reference grid, not two independent
                    // scales.  Use its largest square cell that fits on the
                    // page, otherwise a non-square guide would stretch both
                    // the guide and the board cells.
                    const guideCellSize = Math.min(
                        BOARD.baseSize.width / guideSize.columns,
                        BOARD.baseSize.height / guideSize.rows
                    );
                    Object.assign(BOARD, {
                        size: {
                            width: guideCellSize * columns,
                            height: guideCellSize * rows
                        }
                    });
                }
                // Stretch deliberately allows non-regular hexagons so that the
                // board fills both available dimensions.  The other modes keep
                // the cells regular and size the board to fit.
                if (global.config.cellShape === 'hexagon' && global.config.sameSize !== 'cover') {
                    // Axial coordinates have a half-cell offset on one axis.  Use
                    // those extents for every size mode, including 3 sides.
                    const boardMetrics = getHexGridMetrics(columns, rows);
                    let cellWidth;
                    if (global.config.sameSize === 'diff') {
                        // Match the regular cells in the displayed hex guide.
                        const { columns: guideColumns, rows: guideRows, third: guideThird } = guideSize;
                        const flatTop = global.config.hexOrientation === 'side';
                        let guideWidthUnits;
                        let guideHeightUnits;
                        if (global.config.sizeMode === 'side') {
                            guideWidthUnits = flatTop ? 1.5 * guideColumns - 0.5 : 2 * guideColumns - 1;
                            guideHeightUnits = flatTop ? 2 * guideColumns - 1 : 1.5 * guideColumns - 0.5;
                        } else if (global.config.sizeMode === 'depth') {
                            const diagonalUnits = guideColumns + 1.5 * guideRows + 0.5 * guideThird - 2;
                            const shortUnits = 0.75 * (guideRows + guideThird) - 0.5;
                            guideWidthUnits = flatTop ? shortUnits : diagonalUnits;
                            guideHeightUnits = flatTop ? diagonalUnits : shortUnits;
                        } else {
                            const guideMetrics = getHexGridMetrics(guideColumns, guideRows);
                            guideWidthUnits = guideMetrics.horizontalUnits;
                            guideHeightUnits = guideMetrics.verticalUnits;
                        }
                        cellWidth = Math.min(
                            BOARD.baseSize.width / guideWidthUnits,
                            BOARD.baseSize.height / (guideHeightUnits * boardMetrics.heightRatio)
                        );
                    } else {
                        cellWidth = Math.min(
                            BOARD.baseSize.width / boardMetrics.horizontalUnits,
                            BOARD.baseSize.height / (boardMetrics.verticalUnits * boardMetrics.heightRatio)
                        );
                    }
                    if (global.config.sameSize !== 'diff' && ['side', 'depth'].includes(global.config.sizeMode)) {
                        // The visible hex region is not necessarily the same
                        // size as its enclosing staggered grid.  Measure its
                        // actual axial-cell bounds so every side combination
                        // remains within the drawable area.
                        const contentBounds = getHexDepthContentBounds(1, boardMetrics.heightRatio);
                        const contentWidth = contentBounds.right - contentBounds.left;
                        const contentHeight = contentBounds.bottom - contentBounds.top;
                        cellWidth = Math.min(
                            BOARD.baseSize.width / contentWidth,
                            BOARD.baseSize.height / contentHeight
                        );
                    }
                    Object.assign(BOARD, {
                        size: {
                            width: cellWidth * boardMetrics.horizontalUnits,
                            height: cellWidth * boardMetrics.heightRatio * boardMetrics.verticalUnits
                        }
                    });
                }
                if (global.config.cellShape === 'hexagon'
                    && global.config.sameSize === 'cover'
                    && ['side', 'depth'].includes(global.config.sizeMode)) {
                    // A three-sided board can occupy less space than its
                    // rectangular axial-coordinate envelope.  Scale against
                    // the occupied bounds so Stretch reaches every edge.
                    const flatTop = global.config.hexOrientation === 'side';
                    const horizontalUnits = flatTop
                        ? 0.75 * columns + 0.25
                        : columns + 0.5 * (rows - 1);
                    const verticalUnits = flatTop
                        ? rows + 0.5 * (columns - 1)
                        : 0.75 * rows + 0.25;
                    const contentBounds = getHexDepthContentBounds(1, 1);
                    Object.assign(BOARD, {
                        size: {
                            width: BOARD.baseSize.width * horizontalUnits / (contentBounds.right - contentBounds.left),
                            height: BOARD.baseSize.height * verticalUnits / (contentBounds.bottom - contentBounds.top)
                        }
                    });
                }
                const contentBounds = getHexDepthContentBounds();
                Object.assign(BOARD, {
                    padding: contentBounds
                        ? {
                            x: (BOARD.baseSize.width - (contentBounds.right - contentBounds.left)) / 2 - contentBounds.left,
                            y: (BOARD.baseSize.height - (contentBounds.bottom - contentBounds.top)) / 2 - contentBounds.top
                        }
                        : {
                            x: (BOARD.baseSize.width - BOARD.size.width) / 2,
                            y: (BOARD.baseSize.height - BOARD.size.height) / 2
                        }
                });
            }
                        
            function drawDiamond(ctx, c, r, radiusX, radiusY) {
                const { columns, rows } = getGridSize();
                    const [posX, posY] = ['left', 'top'];
                    const cellWidth = BOARD.size.width / columns;
                    const cellHeight = BOARD.size.height / rows;
                    const centerX = BOARD.margin.x + c * cellWidth + ( posX === 'left' ? 0 : cellWidth );
                    const centerY = BOARD.margin.y + r * cellHeight + ( posY === 'top' ? 0 : cellHeight );
                    const radiusMMX = radiusX ? (radiusX * PX_TO_MM) : (cellWidth / 4);
                    const radiusMMY = radiusY ? (radiusY * PX_TO_MM) : (cellHeight / 4);
                    ctx.beginPath();
                    ctx.moveTo(centerX            , centerY - radiusMMY);
                    ctx.lineTo(centerX + radiusMMX, centerY            );
                    ctx.lineTo(centerX            , centerY + radiusMMY);
                    ctx.lineTo(centerX - radiusMMX, centerY            );
                    ctx.lineTo(centerX            , centerY - radiusMMY);
                    ctx.fillStyle = '#000000';
                    ctx.fill();
                }

                function hexCellCount(row) {
                    const { columns, rows } = getGridSize();
                    if (global.config.cellShape !== 'hexagon') {
                        return columns;
                    }
                    if (global.config.sizeMode === 'grid') {
                        return columns;
                    }
                    if (global.config.sizeMode === 'side') {
                        const cellsPerSide = getCellsPerSide();
                        const { rows } = getGridSize();
                        return cellsPerSide + Math.min(row, rows - 1 - row);
                    }
                    if (global.config.sizeMode === 'depth') {
                        const { first, second, third } = getHexDepthSides();
                        if (row < first) {
                            return third + Math.min(row, second - 1);
                        }
                        return third + second - 1 - (row - first + 1);
                    }
                    return columns;
                }

                function isHexCellActive(c, r) {
                    return true;
                }

                function hexCellMetrics(c, r) {
                    const { columns, rows } = getGridSize();
                    const flatTop = global.config.hexOrientation === 'side';
                    const horizontalUnits = flatTop
                        ? 0.75 * columns + 0.25
                        : columns + 0.5 * (rows - 1);
                    const verticalUnits = flatTop
                        ? rows + 0.5 * (columns - 1)
                        : 0.75 * rows + 0.25;
                    const cellWidth = global.config.cellShape === 'hexagon'
                        ? BOARD.size.width / horizontalUnits
                        : BOARD.size.width / columns;
                    const cellHeight = global.config.cellShape === 'hexagon'
                            ? BOARD.size.height / verticalUnits
                        : BOARD.size.height / rows;
                    if (global.config.cellShape !== 'hexagon') {
                        return {
                            cellWidth,
                            cellHeight,
                            left: BOARD.margin.x + BOARD.padding.x + c * cellWidth,
                            top: BOARD.margin.y + BOARD.padding.y + r * cellHeight
                        };
                    }
                    if (global.config.sizeMode === 'side') {
                        const cellsPerSide = getCellsPerSide();
                        const axialRow = r - (cellsPerSide - 1);
                        const axialColumn = Math.max(-cellsPerSide + 1, -axialRow - cellsPerSide + 1) + c;
                        return {
                            cellWidth,
                            cellHeight,
                            left: BOARD.margin.x + BOARD.padding.x + (flatTop
                                ? axialColumn * 0.75
                                : axialColumn + axialRow * 0.5) * cellWidth,
                            top: BOARD.margin.y + BOARD.padding.y + (flatTop
                                ? axialRow + axialColumn * 0.5
                                : axialRow * 0.75) * cellHeight
                        };
                    }
                    if (global.config.sizeMode === 'depth') {
                        const { first } = getHexDepthSides();
                        const column = r;
                        const axialRow = c + Math.max(0, first - 1 - column);
                        return {
                            cellWidth,
                            cellHeight,
                            left: BOARD.margin.x + BOARD.padding.x + (flatTop
                                ? column * 0.75
                                : axialRow + column * 0.5) * cellWidth,
                            top: BOARD.margin.y + BOARD.padding.y + (flatTop
                                ? axialRow + column * 0.5
                                : column * 0.75) * cellHeight
                        };
                    }
                    const left = BOARD.margin.x + BOARD.padding.x + (flatTop
                        ? c * 0.75 * cellWidth
                        : (c + r * 0.5) * cellWidth);
                    const top = BOARD.margin.y + BOARD.padding.y + (flatTop
                        ? (r + c * 0.5) * cellHeight
                        : r * 0.75 * cellHeight);
                    return { cellWidth, cellHeight, left, top };
                }

                function cellPath(ctx, c, r) {
                    const { cellWidth, cellHeight, left, top } = hexCellMetrics(c, r);
                    ctx.beginPath();
                    if (global.config.cellShape === 'hexagon') {
                        const vertices = getHexVertices(cellWidth, cellHeight, left, top);
                        vertices.forEach(({ x, y }, vertex) => {
                            if (vertex === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.lineTo(x, y);
                            }
                        });
                        ctx.closePath();
                    } else {
                        ctx.rect(left, top, cellWidth, cellHeight);
                    }
                }

                function getHexVertices(cellWidth, cellHeight, left, top) {
                    const centerX = left + cellWidth / 2;
                    const centerY = top + cellHeight / 2;
                    const sideTop = global.config.hexOrientation === 'side';
                    const startAngle = sideTop ? 0 : -Math.PI / 2;
                    // Scale each axis independently.  With equal aspect ratios
                    // this is a regular hexagon; in Stretch mode it fills the
                    // target rectangle without leaving gaps between cells.
                    const radiusX = sideTop ? cellWidth / 2 : cellWidth / Math.sqrt(3);
                    const radiusY = sideTop ? cellHeight / Math.sqrt(3) : cellHeight / 2;
                    return Array.from({ length: 6 }, (_, vertex) => {
                        const angle = startAngle + vertex * Math.PI / 3;
                        return {
                            x: centerX + Math.cos(angle) * radiusX,
                            y: centerY + Math.sin(angle) * radiusY
                        };
                    });
                }

                function drawBoardBorder(ctx) {
                    const left = BOARD.margin.x + BOARD.padding.x;
                    const top = BOARD.margin.y + BOARD.padding.y;
                    const right = left + BOARD.size.width;
                    const bottom = top + BOARD.size.height;
                    ctx.beginPath();
                    if (global.config.cellShape === 'hexagon') {
                        const edges = new Map();
                        const { columns, rows } = getGridSize();
                        for (let r = 0; r < rows; r++) {
                            const rowCellCount = hexCellCount(r);
                            for (let c = 0; c < rowCellCount; c++) {
                                if (!isHexCellActive(c, r)) continue;
                                const { cellWidth, cellHeight, left: cellLeft, top: cellTop } = hexCellMetrics(c, r);
                                const vertices = getHexVertices(cellWidth, cellHeight, cellLeft, cellTop);
                                for (let vertex = 0; vertex < 6; vertex++) {
                                    const start = vertices[vertex];
                                    const end = vertices[(vertex + 1) % 6];
                                    const startKey = `${start.x.toFixed(6)},${start.y.toFixed(6)}`;
                                    const endKey = `${end.x.toFixed(6)},${end.y.toFixed(6)}`;
                                    const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
                                    const edge = edges.get(key);
                                    if (edge) {
                                        edge.count++;
                                    } else {
                                        edges.set(key, { start, end, count: 1 });
                                    }
                                }
                            }
                        }
                        edges.forEach(edge => {
                            if (edge.count === 1) {
                                ctx.moveTo(edge.start.x, edge.start.y);
                                ctx.lineTo(edge.end.x, edge.end.y);
                            }
                        });
                    } else {
                        ctx.rect(left, top, BOARD.size.width, BOARD.size.height);
                    }
                    ctx.strokeStyle = getBorderColor('boardBorder');
                    ctx.stroke();
                }

                function fillCell(ctx, c, r, color) {
                    cellPath(ctx, c, r);
                    ctx.fillStyle = color;
                    ctx.fill();
                }

                function isCheckeredCell(c, r) {
                    return getCheckeredIndex(c, r) === 2;
                }

                function getCheckeredIndex(c, r) {
                    if (global.config.cellShape === 'square') {
                        return (c + r) % 2;
                    }

                    const rowOffset = Number(global.config.inverted);
                    if (global.config.sizeMode === 'side') {
                        const cellsPerSide = getCellsPerSide();
                        const axialRow = r - (cellsPerSide - 1);
                        const axialColumn = Math.max(-cellsPerSide + 1, -axialRow - cellsPerSide + 1) + c;
                        return ((axialColumn + 2 * axialRow + rowOffset) % 3 + 3) % 3;
                    }
                    if (global.config.sizeMode === 'depth') {
                        const { first } = getHexDepthSides();
                        const outerAxis = r;
                        const innerAxis = c + Math.max(0, first - 1 - outerAxis);
                        // Use the real axial coordinates, rather than the
                        // compact indices used to enumerate each column.  The
                        // three axial neighbour directions then always change
                        // the colour by 1 or 2 modulo 3.
                        return ((global.config.hexOrientation === 'side'
                            ? outerAxis + 2 * innerAxis
                            : innerAxis + 2 * outerAxis
                        ) + rowOffset) % 3;
                    }
                    return (c + 2 * r + rowOffset) % 3;
                }

                function getThemeValues() {
                    if (global.config.theme === 'Custom colors') return global.config.customTheme;
                    if (global.config.theme === 'Custom textures') return global.config.customTextureTheme;
                    return THEMES[global.config.theme] || THEMES.Wood;
                }

                function getBorderColor(configKey) {
                    const configuredValue = global.config[configKey];
                    return configuredValue === 'theme'
                        ? (getThemeValues()[configKey] || '')
                        : configuredValue;
                }

                function getThemeTile(c, r) {
                    const theme = getThemeValues();
                    const tiles = global.config.cellShape === 'square'
                        ? (global.config.inverted
                            ? [theme.light, theme.dark]
                            : [theme.dark, theme.light])
                        : (global.config.inverted
                            ? [theme.light, theme.mid, theme.dark]
                            : [theme.dark, theme.mid, theme.light]);
                    return tiles[getCheckeredIndex(c, r)];
                }

                function getThemeImage(value) {
                    return window.onloadResources[value]?.img;
                }

                function isUsableThemeImage(image) {
                    return image?.complete && image.naturalWidth > 0;
                }

                function loadThemeImage(url) {
                    if (!url || window.onloadResources[url]) return;
                    const resource = window.onloadResources[url] = { url };
                    const image = resource.img = new Image();
                    image.onload = () => generate();
                    image.onerror = () => {
                        console.warn(`Could not load custom texture: ${url}`);
                        generate();
                    };
                    image.src = url;
                }

                function drawCellImage(ctx, image, c, r) {
                    const { cellWidth, cellHeight, left, top } = hexCellMetrics(c, r);
                    ctx.save();
                    cellPath(ctx, c, r);
                    ctx.clip();
                    ctx.drawImage(image, left, top, cellWidth, cellHeight);
                    ctx.restore();
                }

                function drawCellThemeValue(ctx, value, c, r) {
                    const image = getThemeImage(value);
                    if (isUsableThemeImage(image)) drawCellImage(ctx, image, c, r);
                    // A URL may be present even when its image failed to load;
                    // it cannot be used as a canvas fill style, so fall back.
                    else fillCell(ctx, c, r, image ? '#ffffff' : (value || '#ffffff'));
                }

                function drawClippedBoardImage(ctx, image) {
                    const { rows } = getGridSize();
                    const boardBounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
                    // Keep the source image in its original board-sized
                    // position, then mask it.  The image must use the visible
                    // hex board's bounds, rather than the larger staggered-grid
                    // envelope used internally for cell positioning.
                    const maskCanvas = document.createElement('canvas');
                    maskCanvas.width = CANVAS.width;
                    maskCanvas.height = CANVAS.height;
                    const maskCtx = maskCanvas.getContext('2d');
                    const boardMask = document.createElement('canvas');
                    boardMask.width = CANVAS.width;
                    boardMask.height = CANVAS.height;
                    const boardMaskCtx = boardMask.getContext('2d');
                    for (let r = 0; r < rows; r++) {
                        const rowCellCount = hexCellCount(r);
                        for (let c = 0; c < rowCellCount; c++) {
                            if (!isHexCellActive(c, r)) continue;
                            cellPath(boardMaskCtx, c, r);
                            boardMaskCtx.fill();
                            const { cellWidth, cellHeight, left, top } = hexCellMetrics(c, r);
                            getHexVertices(cellWidth, cellHeight, left, top).forEach(vertex => {
                                boardBounds.left = Math.min(boardBounds.left, vertex.x);
                                boardBounds.top = Math.min(boardBounds.top, vertex.y);
                                boardBounds.right = Math.max(boardBounds.right, vertex.x);
                                boardBounds.bottom = Math.max(boardBounds.bottom, vertex.y);
                            });
                        }
                    }
                    const boardWidth = boardBounds.right - boardBounds.left;
                    const boardHeight = boardBounds.bottom - boardBounds.top;
                    // Match `background: center / cover`: retain the image's
                    // aspect ratio, crop its excess dimension, and centre it
                    // inside the visible board bounds.
                    const boardRatio = boardWidth / boardHeight;
                    const imageRatio = image.naturalWidth / image.naturalHeight;
                    let sourceX = 0;
                    let sourceY = 0;
                    let sourceWidth = image.naturalWidth;
                    let sourceHeight = image.naturalHeight;
                    if (imageRatio > boardRatio) {
                        sourceWidth = sourceHeight * boardRatio;
                        sourceX = (image.naturalWidth - sourceWidth) / 2;
                    } else if (imageRatio < boardRatio) {
                        sourceHeight = sourceWidth / boardRatio;
                        sourceY = (image.naturalHeight - sourceHeight) / 2;
                    }
                    maskCtx.drawImage(
                        image,
                        sourceX, sourceY, sourceWidth, sourceHeight,
                        boardBounds.left, boardBounds.top, boardWidth, boardHeight
                    );
                    maskCtx.globalCompositeOperation = 'destination-in';
                    maskCtx.drawImage(boardMask, 0, 0);
                    ctx.drawImage(maskCanvas, 0, 0);
                }

                // The guide is an on-screen sizing aid.  It is deliberately
                // drawn after the PDF has been built so it never becomes part
                // of the printable board image.
                function drawPreviewGuideGrid() {
                    if (global.config.sameSize !== 'diff' || global.config.showGuideGrid === false) return;

                    const { columns: guideColumns, rows: guideRows, third: guideThird } = getGuideGridSize();
                    ctx0.save();
                    ctx0.beginPath();
                    // The canvas is rendered at print resolution and then
                    // reduced for the preview, so a 3 px line is effectively
                    // invisible on screen.
                    ctx0.setLineDash([48, 24]);
                    ctx0.lineWidth = CONFIG_GRID_LINE_WIDTH;
                    ctx0.strokeStyle = 'rgba(0, 110, 255, 0.9)';
                    if (global.config.cellShape === 'hexagon') {
                        if (['side', 'depth'].includes(global.config.sizeMode)) {
                            // The guide has its own dimensions, so it is not
                            // tied to the board's cells.  It can consequently
                            // be larger than (and visibly extend beyond) the
                            // board while retaining the selected board shape.
                            const guideCells = [];
                            const flatTop = global.config.hexOrientation === 'side';
                            const guideSide = guideColumns;
                            const guideRowCount = global.config.sizeMode === 'side'
                                ? guideSide * 2 - 1
                                : guideColumns + guideRows - 1;
                            for (let r = 0; r < guideRowCount; r++) {
                                let count;
                                let start;
                                let outer;
                                if (global.config.sizeMode === 'side') {
                                    outer = r - (guideSide - 1);
                                    count = guideSide + Math.min(r, guideRowCount - 1 - r);
                                    start = Math.max(-guideSide + 1, -outer - guideSide + 1);
                                } else {
                                    outer = r;
                                    count = r < guideColumns
                                        ? guideThird + Math.min(r, guideRows - 1)
                                        : guideThird + guideRows - 1 - (r - guideColumns + 1);
                                    start = Math.max(0, guideColumns - 1 - r);
                                }
                                for (let c = 0; c < count; c++) {
                                    const inner = start + c;
                                    guideCells.push({
                                        x: flatTop ? inner * 0.75 : outer + inner * 0.5,
                                        y: flatTop ? outer + inner * 0.5 : inner * 0.75
                                    });
                                }
                            }
                            const minX = Math.min(...guideCells.map(cell => cell.x));
                            const minY = Math.min(...guideCells.map(cell => cell.y));
                            const maxX = Math.max(...guideCells.map(cell => cell.x + 1));
                            const maxY = Math.max(...guideCells.map(cell => cell.y + 1));
                            const regularHexHeight = 2 / Math.sqrt(3);
                            const heightRatio = flatTop ? 1 / regularHexHeight : regularHexHeight;
                            const cellWidth = Math.min(
                                BOARD.baseSize.width / (maxX - minX),
                                BOARD.baseSize.height / ((maxY - minY) * heightRatio)
                            );
                            const cellHeight = cellWidth * heightRatio;
                            const contentWidth = (maxX - minX) * cellWidth;
                            const contentHeight = (maxY - minY) * cellHeight;
                            const left = BOARD.margin.x + (BOARD.baseSize.width - contentWidth) / 2 - minX * cellWidth;
                            const top = BOARD.margin.y + (BOARD.baseSize.height - contentHeight) / 2 - minY * cellHeight;
                            guideCells.forEach(cell => {
                                    const vertices = getHexVertices(cellWidth, cellHeight, left + cell.x * cellWidth, top + cell.y * cellHeight);
                                    vertices.forEach(({ x, y }, vertex) => {
                                        if (vertex === 0) ctx0.moveTo(x, y);
                                        else ctx0.lineTo(x, y);
                                    });
                                    ctx0.closePath();
                            });
                            ctx0.stroke();
                            ctx0.restore();
                            return;
                        }

                        const metrics = getHexGridMetrics(guideColumns, guideRows);
                        const cellWidth = Math.min(
                            BOARD.baseSize.width / metrics.horizontalUnits,
                            BOARD.baseSize.height / (metrics.verticalUnits * metrics.heightRatio)
                        );
                        const cellHeight = cellWidth * metrics.heightRatio;
                        const width = cellWidth * metrics.horizontalUnits;
                        const height = cellHeight * metrics.verticalUnits;
                        // Centre the reference honeycomb in the printable area.
                        const left = BOARD.margin.x + (BOARD.baseSize.width - width) / 2;
                        const top = BOARD.margin.y + (BOARD.baseSize.height - height) / 2;
                        const flatTop = global.config.hexOrientation === 'side';
                        for (let r = 0; r < guideRows; r++) {
                            for (let c = 0; c < guideColumns; c++) {
                                const cellLeft = left + (flatTop ? c * 0.75 : c + r * 0.5) * cellWidth;
                                const cellTop = top + (flatTop ? r + c * 0.5 : r * 0.75) * cellHeight;
                                const vertices = getHexVertices(cellWidth, cellHeight, cellLeft, cellTop);
                                vertices.forEach(({ x, y }, vertex) => {
                                    if (vertex === 0) ctx0.moveTo(x, y);
                                    else ctx0.lineTo(x, y);
                                });
                                ctx0.closePath();
                            }
                        }
                        ctx0.stroke();
                        ctx0.restore();
                        return;
                    }

                    const cellSize = Math.min(
                        BOARD.baseSize.width / guideColumns,
                        BOARD.baseSize.height / guideRows
                    );
                    const width = cellSize * guideColumns;
                    const height = cellSize * guideRows;
                    // Centre the unscaled guide in the available printable area.
                    const left = BOARD.margin.x + (BOARD.baseSize.width - width) / 2;
                    const top = BOARD.margin.y + (BOARD.baseSize.height - height) / 2;
                    for (let c = 0; c <= guideColumns; c++) {
                        const x = left + cellSize * c;
                        ctx0.moveTo(x, top);
                        ctx0.lineTo(x, top + height);
                    }
                    for (let r = 0; r <= guideRows; r++) {
                        const y = top + cellSize * r;
                        ctx0.moveTo(left, y);
                        ctx0.lineTo(left + width, y);
                    }
                    ctx0.stroke();
                    ctx0.restore();
                }

                function generate() {
                    updateBoard();
                    ctx0.fillStyle = '#ffffff';
                    ctx0.fillRect(CANVAS.left, CANVAS.top, CANVAS.width, CANVAS.height);
                    ctx0.filter = 'none';

                    const { columns, rows } = getGridSize();

                    ctx0.lineWidth = CONFIG_GRID_LINE_WIDTH;
                    const theme = getThemeValues();
                    const darkCellValue = theme.dark;
                    const midCellValue = theme.mid;
                    const lightCellValue = theme.light;
                    const cellColors = global.config.cellShape === 'square'
                        ? (global.config.inverted
                            ? [lightCellValue, darkCellValue]
                            : [darkCellValue, lightCellValue])
                        : (global.config.inverted
                            ? [lightCellValue, midCellValue, darkCellValue]
                            : [darkCellValue, midCellValue, lightCellValue]);
                    if (global.config.checkered) {
                        for (let r = 0; r < rows; r++) {
                            const rowCellCount = global.config.cellShape === 'hexagon' ? hexCellCount(r) : columns;
                            for (let c = 0; c < rowCellCount; c++) {
                                if (!isHexCellActive(c, r)) continue;
                                drawCellThemeValue(ctx0, cellColors[getCheckeredIndex(c, r)], c, r);
                            }
                        }
                    } else {
                        const cellValue = global.config.inverted ? lightCellValue : darkCellValue;
                        const image = getThemeImage(cellValue);
                        if (global.config.cellShape === 'hexagon') {
                            if (isUsableThemeImage(image)) drawClippedBoardImage(ctx0, image);
                            else for (let r = 0; r < rows; r++) for (let c = 0; c < hexCellCount(r); c++) {
                                if (isHexCellActive(c, r)) fillCell(ctx0, c, r, image ? '#ffffff' : cellValue);
                            }
                        } else {
                            ctx0.beginPath();
                            ctx0.rect(BOARD.margin.x + BOARD.padding.x, BOARD.margin.y + BOARD.padding.y, BOARD.size.width, BOARD.size.height);
                            if (isUsableThemeImage(image)) ctx0.drawImage(image, BOARD.margin.x + BOARD.padding.x, BOARD.margin.y + BOARD.padding.y, BOARD.size.width, BOARD.size.height);
                            else { ctx0.fillStyle = image ? '#ffffff' : (cellValue || '#ffffff'); ctx0.fill(); }
                        }
                    }

                const gridColor = getBorderColor('grid');
                if (gridColor) {
                    ctx0.filter = 'none';
                    if (global.config.cellShape === 'hexagon') {
                        for (let r = 0; r < rows; r++) {
                            const rowCellCount = global.config.cellShape === 'hexagon' ? hexCellCount(r) : columns;
                            for (let c = 0; c < rowCellCount; c++) {
                                if (!isHexCellActive(c, r)) continue;
                                cellPath(ctx0, c, r);
                                ctx0.strokeStyle = gridColor;
                                ctx0.stroke();
                            }
                        }
                    } else {
                        ctx0.beginPath();
                        for (let c = 0; c <= columns; c++) {
                            const start = {
                                x: BOARD.margin.x + BOARD.padding.x + BOARD.size.width / columns * c,
                                y: BOARD.margin.y + BOARD.padding.y
                            };
                            ctx0.moveTo(start.x, start.y);
                            ctx0.lineTo(start.x, start.y + BOARD.size.height);
                        }
                        for (let r = 0; r <= rows; r++) {
                            const start = {
                                x: BOARD.margin.x + BOARD.padding.x,
                                y: BOARD.margin.y + BOARD.padding.y + BOARD.size.height / rows * r
                            };
                            ctx0.moveTo(start.x, start.y);
                            ctx0.lineTo(start.x + BOARD.size.width, start.y);
                        }
                        ctx0.strokeStyle = gridColor;
                        ctx0.stroke();

                                            }
                }

                if (getBorderColor('boardBorder')) {
                    drawBoardBorder(ctx0);
                }

                if (CONFIG_DIAMONDS) {
                    for (let r = 1; r < rows; r++) {
                        for (let c = 1; c < columns; c++) {
                            drawDiamond(ctx0, c, r);
                        }
                    }
                }

                const cellProperties = CONFIG_CELL_PROPERTIES || [];

                cellProperties.forEach(cellProps => {
                    switch (cellProps.type) {
                        case 'circle': {
                            const [c, r] = cellProps.coord;
                            const [posX, posY] = cellProps.position.split(' ');
                            const cellWidth = BOARD.size.width / columns;
                            const cellHeight = BOARD.size.height / rows;
                            const centerX = BOARD.margin.x + c * cellWidth + ( posX === 'left' ? 0 : cellWidth );
                            const centerY = BOARD.margin.y + r * cellHeight + ( posY === 'top' ? 0 : cellHeight );
                            const radiusMM = cellProps.radius * PX_TO_MM;
                            ctx0.beginPath();
                            ctx0.arc(centerX, centerY, radiusMM, 2 * Math.PI, false);
                            ctx0.fillStyle = '#000000';
                            ctx0.fill();
                            break;
                        }
                        case 'diamond': {
                            const [c, r] = cellProps.coord;
                            drawDiamond(ctx0, c, r);
                            break;
                        }
                    }
                });

                ctx0.filter = 'none';

                // The preview must remain usable even if the optional PDF
                // renderer is unavailable (for example when the CDN cannot
                // be reached).  Build the PDF separately, then always paint
                // the on-screen-only guide afterwards.
                try {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    throw new Error('The PDF library did not load. Check your internet connection and reload the page.');
                }
                pdfPreviewPanel.classList.remove('is-ready');
                pdfPreviewPanel.classList.add('is-loading');
                pdfPreviewStatus.textContent = 'Preparing PDF preview…';
                const paperSize = (format) => {
                    const result = { format };
                    if (!format) {
                        throw new Error('Paper format not provided');
                    }
                    if (typeof format === 'string') {
                        if (format === 'custom') {
                            const width = Math.max(1, Number(global.config.customFormat?.width) || 210);
                            const height = Math.max(1, Number(global.config.customFormat?.height) || 297);
                            result.format = [width, height];
                            return result;
                        }
                        // a0 - a10
                        // b0 - b10
                        // c0 - c10
                        // dl
                        // letter
                        // government-letter
                        // legal
                        // junior-legal
                        // ledger
                        // tabloid
                        // credit-card
                        if (format === 'letter') {
                            return result;
                        }
                        return result;
                    }
                    if (Array.isArray(format)) {
                        return result;
                    }
                    throw new Error("Paper format not supported");
                };

                // The selected format is the size of each physical output sheet.
                // It must never be halved merely because the board uses two sheets.
                const { format: sheetFormat } = paperSize(global.config.format);

                // A complete board is wider than it is tall, so the
                // single-sheet PDF uses the selected paper in landscape too.
                const doc0 = new jspdf.jsPDF({orientation: 'landscape', format: sheetFormat});
                doc0.viewerPreferences({'HideWindowUI': true}, true);
                const doc1 = new jspdf.jsPDF({orientation: 'landscape', format: sheetFormat });
                
                const DOC_LEFT = 0;
                const DOC_TOP = 0;
                const FF_LONG = doc0.internal.pageSize.getWidth();
                const FF_SHORT = doc0.internal.pageSize.getHeight();
                const HF_LONG = doc1.internal.pageSize.getWidth();
                const HF_SHORT = doc1.internal.pageSize.getHeight();
                // Each source half is twice as wide as it is high. Fit it on a
                // complete output sheet without changing the board's proportions.
                const SPLIT_IMAGE_WIDTH = Math.min(HF_LONG, HF_SHORT * 2 * BOARD.baseRatio);
                const SPLIT_IMAGE_HEIGHT = SPLIT_IMAGE_WIDTH / (2 * BOARD.baseRatio);
                const SPLIT_IMAGE_LEFT = (HF_LONG - SPLIT_IMAGE_WIDTH) / 2;
                // The two landscape sheets form a foldable board: keep the
                // first half against the top edge and the second against the
                // bottom edge, leaving the joining area on opposite sides.
                const SPLIT_IMAGE_TOP_FIRST = 0;
                const SPLIT_IMAGE_TOP_SECOND = HF_SHORT - SPLIT_IMAGE_HEIGHT;

                // Fit the complete board inside the actual single-sheet page.
                const SINGLE_IMAGE_HEIGHT = Math.min(FF_SHORT, FF_LONG / BOARD.baseRatio);
                const SINGLE_IMAGE_WIDTH = SINGLE_IMAGE_HEIGHT * BOARD.baseRatio;
                const FF_MARGIN_LEFT = (FF_LONG - SINGLE_IMAGE_WIDTH) / 2;
                const FF_MARGIN_TOP = CONFIG_CENTER ? (FF_SHORT - SINGLE_IMAGE_HEIGHT) / 2 : 0;

                if (global.config.split === 1) {

                    doc0.addImage({
                        imageData: canvas0.toDataURL('image/jpeg', 0.6),
                        format: 'JPEG',
                        x: DOC_LEFT + FF_MARGIN_LEFT,
                        y: DOC_TOP + FF_MARGIN_TOP,
                        width: SINGLE_IMAGE_WIDTH,
                        height: SINGLE_IMAGE_HEIGHT
                    });

                    setPdfPreview(doc0.output('blob'));

                } else {

                    const tempCanvas1 = document.createElement('canvas');
                    tempCanvas1.style.display = 'none';
                    tempCanvas1.width = CANVAS.width;
                    tempCanvas1.height = CANVAS.halfHeight;
                    const tempCtx1 = tempCanvas1.getContext('2d');
                    tempCtx1.drawImage(canvas0, CANVAS.left, CANVAS.top, CANVAS.width, CANVAS.halfHeight, 0, 0, tempCanvas1.width, tempCanvas1.height);
                    doc1.addImage({
                        imageData: tempCanvas1.toDataURL('image/jpeg', 0.6),
                        format: 'JPEG',
                        x: DOC_LEFT + SPLIT_IMAGE_LEFT,
                        y: DOC_TOP + SPLIT_IMAGE_TOP_FIRST,
                        width: SPLIT_IMAGE_WIDTH,
                        height: SPLIT_IMAGE_HEIGHT
                    });
                    
                    const tempCanvas2 = document.createElement('canvas');
                    tempCanvas2.width = CANVAS.width;
                    tempCanvas2.height = CANVAS.halfHeight;
                    const tempCtx2 = tempCanvas2.getContext('2d');
                    tempCtx2.drawImage(canvas0, CANVAS.left, CANVAS.center.y, CANVAS.width, CANVAS.halfHeight, 0, 0, tempCanvas2.width, tempCanvas2.height);
                    doc1.addPage();
                    doc1.addImage({
                        imageData: tempCanvas2.toDataURL('image/jpeg', 0.6),
                        format: 'JPEG',
                        x: DOC_LEFT + SPLIT_IMAGE_LEFT,
                        y: DOC_TOP + SPLIT_IMAGE_TOP_SECOND,
                        width: SPLIT_IMAGE_WIDTH,
                        height: SPLIT_IMAGE_HEIGHT
                    });

                    setPdfPreview(doc1.output('blob'));

                }

                } catch (error) {
                    console.warn('PDF preview could not be generated.', error);
                    setPdfPreviewError(error);
                }

                drawPreviewGuideGrid();

            }

            window.addEventListener('pdf-preview-requested', generate);

            function save () {
                localStorage.setItem('global', JSON.stringify(global));
            }

            function load () {
                const globalStr = localStorage.getItem('global');
                if (!globalStr) return;
                const loadedGlobal = JSON.parse(globalStr);
                global = {
                    config: { ...global.config, ...loadedGlobal?.config }
                };
                if (global.config.sizeMode === 'radius') {
                    global.config.sizeMode = 'side';
                }
                if (global.config.cellsPerSide === undefined && global.config.radius !== undefined) {
                    global.config.cellsPerSide = global.config.radius;
                }
                // Preserve boards saved before themes were introduced.
                if (!global.config.theme) global.config.theme = global.config.wood === false ? 'Red' : 'Wood';
                if (global.config.theme === 'Custom') global.config.theme = 'Custom colors';
                global.config.customTheme = {
                    ...defaultSettings.config.customTheme,
                    ...global.config.customTheme
                };
                global.config.customFormat = {
                    ...defaultSettings.config.customFormat,
                    ...global.config.customFormat
                };
                global.config.customTextureTheme = {
                    ...defaultSettings.config.customTextureTheme,
                    ...global.config.customTextureTheme
                };
                // The first dimension is shared by all board-size modes.  Older
                // saved settings stored the one-side value separately, so bring
                // it into sync when loading them.
                const firstSize = global.config.sizeMode === 'side'
                    ? getCellsPerSide()
                    : Math.max(1, Number(global.config.size.columns) || 1);
                global.config.cellsPerSide = firstSize;
                global.config.size.columns = firstSize;
                global.config.baseSize.third ??= global.config.baseSize.rows;
            }

            function ui() {
                load();
                // Border colours are also theme properties, but only the cell
                // texture values are image URLs.
                ['light', 'mid', 'dark'].forEach(key => loadThemeImage(global.config.customTextureTheme[key]));
                const uiElement = document.getElementById('ui');
                const NUMBER_INPUT_DEBOUNCE_MS = 300;
                let numberInputTimer;
                const scheduleNumberInputUpdate = () => {
                    clearTimeout(numberInputTimer);
                    numberInputTimer = setTimeout(() => {
                        save();
                        generate();
                    }, NUMBER_INPUT_DEBOUNCE_MS);
                };

                const formatElement = uiElement.querySelector('#config-format');
                const customFormatRow = uiElement.querySelector('#config-custom-format-row');
                const customFormatWidthElement = uiElement.querySelector('#config-custom-format-width');
                const customFormatHeightElement = uiElement.querySelector('#config-custom-format-height');
                const syncCustomFormatControls = () => {
                    const isCustom = global.config.format === 'custom';
                    // This is a row in the table-style UI, and CSS hides it by default, so it needs an explicit visible display value.
                    customFormatRow.style.display = isCustom ? 'table-row' : 'none';
                    customFormatWidthElement.value = global.config.customFormat.width;
                    customFormatHeightElement.value = global.config.customFormat.height;
                };
                formatElement.value = global.config.format;
                formatElement.addEventListener('change', event => {
                    global.config.format = event.target.value;
                    syncCustomFormatControls();
                    save();
                    generate();
                });
                customFormatWidthElement.addEventListener('input', event => {
                    if (event.target.value === '') return;
                    global.config.customFormat.width = Math.max(1, Number(event.target.value));
                    save();
                    generate();
                });
                customFormatHeightElement.addEventListener('input', event => {
                    if (event.target.value === '') return;
                    global.config.customFormat.height = Math.max(1, Number(event.target.value));
                    save();
                    generate();
                });
                syncCustomFormatControls();
                // Some browsers restore form controls after the script has run.
                // Reconcile that restored selection so Custom size always shows its fields.
                window.addEventListener('pageshow', () => {
                    if (formatElement.value === global.config.format) return;
                    global.config.format = formatElement.value;
                    syncCustomFormatControls();
                    save();
                    generate();
                }, { once: true });

                const sizeModeElements = uiElement.querySelectorAll('[name="config-size-mode"]');
                const cellsPerSideElement = uiElement.querySelector('#config-cells-per-side');
                const syncFirstSizeInput = () => {
                    cellsPerSideElement.value = global.config.size.columns;
                };
                const syncSizeMode = () => {
                    const sizeModeElement = sizeModeElements[0];
                    const dimensionCount = sizeModeElement.selectedIndex + 1;
                    const dimensionElements = uiElement.querySelectorAll('.config-size-dimension');
                    const separatorElements = uiElement.querySelectorAll('.config-size-separator');
                    dimensionElements.forEach((element, index) => {
                        element.style.display = index < dimensionCount ? '' : 'none';
                    });
                    separatorElements.forEach((element, index) => {
                        element.style.display = index < dimensionCount - 1 ? '' : 'none';
                    });
                    const baseDimensionElements = uiElement.querySelectorAll('.config-base-size-dimension');
                    const baseSeparatorElements = uiElement.querySelectorAll('.config-base-size-separator');
                    baseDimensionElements.forEach((element, index) => {
                        element.style.display = index < dimensionCount ? '' : 'none';
                    });
                    baseSeparatorElements.forEach((element, index) => {
                        element.style.display = index < dimensionCount - 1 ? '' : 'none';
                    });
                    syncFirstSizeInput();
                };
                sizeModeElements.forEach(input => {
                    input.value = global.config.sizeMode;
                    const updateSizeMode = event => {
                        // Modern browsers emit `input` as soon as a select value
                        // changes, while `change` is retained as a fallback.  Do
                        // not redraw twice when both events are delivered.
                        if (event.target.value === global.config.sizeMode) return;
                        global.config.sizeMode = event.target.value;
                        syncSizeMode();
                        save();
                        generate();
                    };
                    input.addEventListener('input', updateSizeMode);
                    input.addEventListener('change', updateSizeMode);
                });
                cellsPerSideElement.addEventListener('input', event => {
                    if (event.target.value === '') return;
                    const value = Math.max(1, Number(event.target.value));
                    global.config.cellsPerSide = value;
                    global.config.size.columns = value;
                    syncFirstSizeInput();
                    scheduleNumberInputUpdate();
                });
                syncSizeMode();

                const splitElements = uiElement.querySelectorAll('[name="config-split"]');
                splitElements.forEach(input => {
                    input.checked = global.config.split === Number(input.value);
                    input.addEventListener('change', event => {
                        global.config.split = Number(event.target.value);
                        console.log(global.config.split)
                        save();
                        generate();
                    });
                });

                const sizeElements = uiElement.querySelectorAll('[name="config-size"]');
                sizeElements.forEach(input => {
                    const key = input.id.match(/-columns$/)
                        ? 'columns'
                        : input.id.match(/-rows$/) ? 'rows' : 'third';
                    input.value = global.config.size[key];
                    input.addEventListener('input', event => {
                        if (event.target.value === '') return;
                        global.config.size[key] = Number(event.target.value);
                        console.log(global.config.size)
                        scheduleNumberInputUpdate();
                    });
                });

                const baseSizeElements = uiElement.querySelectorAll('[name="config-baseSize"]');
                baseSizeElements.forEach(input => {
                    const key = input.id.match(/-columns$/)
                        ? 'columns'
                        : input.id.match(/-rows$/) ? 'rows' : 'third';
                    input.value = global.config.baseSize[key];
                    input.addEventListener('input', event => {
                        if (event.target.value === '') return;
                        global.config.baseSize[key] = Number(event.target.value);
                        console.log(global.config.baseSize)
                        scheduleNumberInputUpdate();
                    });
                });

                const sameSizeElements = uiElement.querySelectorAll('[name="config-sameSize"]');
                sameSizeElements.forEach(input => {
                    input.checked = global.config.sameSize === input.value;
                    input.addEventListener('change', event => {
                        global.config.sameSize = event.target.value;
                        console.log(global.config.sameSize)
                        save();
                        generate();
                    });
                });

                const showGuideGridElement = uiElement.querySelector('#config-show-guide-grid');
                showGuideGridElement.checked = global.config.showGuideGrid !== false;
                showGuideGridElement.addEventListener('change', event => {
                    global.config.showGuideGrid = event.target.checked;
                    save();
                    generate();
                });

                const themeElement = uiElement.querySelector('#config-theme');
                Object.keys(THEMES).forEach(themeName => {
                    const option = document.createElement('option');
                    option.value = themeName;
                    option.textContent = themeName;
                    themeElement.append(option);
                });
                const customThemeOption = document.createElement('option');
                customThemeOption.value = 'Custom colors';
                customThemeOption.textContent = 'Custom colors';
                themeElement.append(customThemeOption);
                const customTextureThemeOption = document.createElement('option');
                customTextureThemeOption.value = 'Custom textures';
                customTextureThemeOption.textContent = 'Custom textures';
                themeElement.append(customTextureThemeOption);
                const customThemeRow = uiElement.querySelector('#config-custom-theme-row');
                const customTextureThemeRow = uiElement.querySelector('#config-custom-texture-theme-row');
                const themeRow = uiElement.querySelector('#config-theme-row');
                const customThemeInputs = uiElement.querySelectorAll('[name="config-custom-theme"]');
                const customTextureThemeInputs = uiElement.querySelectorAll('[name="config-custom-texture-theme"]');
                const syncCustomThemeControls = () => {
                    const isCustomTheme = global.config.theme === 'Custom colors';
                    const isCustomTextureTheme = global.config.theme === 'Custom textures';
                    // themeRow.classList.toggle('noborder', isCustomTheme || isCustomTextureTheme);
                    // themeRow.classList.toggle('nopadding', isCustomTheme || isCustomTextureTheme);
                    // These rows are hidden by a CSS rule, so use an explicit
                    // table-row value when the matching custom theme is active.
                    customThemeRow.style.display = isCustomTheme ? 'table-row' : 'none';
                    customTextureThemeRow.style.display = isCustomTextureTheme ? 'table-row' : 'none';
                    customThemeInputs.forEach(input => {
                        input.value = global.config.customTheme[input.dataset.themeKey];
                    });
                    customTextureThemeInputs.forEach(input => {
                        input.value = global.config.customTextureTheme[input.dataset.themeKey];
                    });
                };
                themeElement.value = global.config.theme;
                themeElement.addEventListener('change', event => {
                    global.config.theme = event.target.value;
                    syncCustomThemeControls();
                    save();
                    generate();
                });
                customThemeInputs.forEach(input => {
                    input.addEventListener('input', event => {
                        global.config.customTheme[event.target.dataset.themeKey] = event.target.value;
                        save();
                        generate();
                    });
                });
                customTextureThemeInputs.forEach(input => {
                    input.addEventListener('change', event => {
                        const url = event.target.value.trim();
                        global.config.customTextureTheme[event.target.dataset.themeKey] = url;
                        loadThemeImage(url);
                        save();
                        generate();
                    });
                });
                syncCustomThemeControls();
                // Browsers can restore the select value after the initial UI
                // setup. Keep the saved theme and its dependent controls in
                // sync when that happens (as for Custom size above).
                window.addEventListener('pageshow', () => {
                    if (themeElement.value === global.config.theme) return;
                    global.config.theme = themeElement.value;
                    syncCustomThemeControls();
                    save();
                    generate();
                }, { once: true });
                const checkeredElements = uiElement.querySelectorAll('[name="config-checkered"]');
                checkeredElements.forEach(input => {
                    input.checked = global.config.checkered === Boolean(input.value);
                    input.addEventListener('change', event => {
                        global.config.checkered = Boolean(event.target.value);
                        console.log(global.config.checkered)
                        save();
                        generate();
                    });
                });

                const invertedCheckeredElements = uiElement.querySelectorAll('[name="config-inverted"]');
                invertedCheckeredElements.forEach(input => {
                    input.checked = global.config.inverted === Boolean(input.value);
                    input.addEventListener('change', event => {
                        global.config.inverted = Boolean(event.target.value);
                        console.log(global.config.inverted)
                        save();
                        generate();
                    });
                });

                const setupBorderColorControls = (radioName, colorInputId, configKey) => {
                    const elements = uiElement.querySelectorAll(`[name="${radioName}"]`);
                    const customRadio = uiElement.querySelector(`[name="${radioName}"][data-custom-color-radio]`);
                    const colorInput = uiElement.querySelector(`#${colorInputId}`);
                    const presetColors = Array.from(elements)
                        .filter(input => input !== customRadio)
                        .map(input => input.value);
                    const configuredColor = global.config[configKey];

                    // Saved non-preset colours are represented by the custom
                    // option, so existing local settings remain editable.
                    if (!presetColors.includes(configuredColor) && /^#[0-9a-f]{6}$/i.test(configuredColor)) {
                        colorInput.value = configuredColor;
                        customRadio.value = configuredColor;
                    }
                    elements.forEach(input => {
                        input.checked = global.config[configKey] === input.value;
                    });
                    elements.forEach(input => {
                        input.addEventListener('change', event => {
                            global.config[configKey] = event.target.value;
                            save();
                            generate();
                        });
                    });
                    colorInput.addEventListener('input', event => {
                        customRadio.value = event.target.value;
                        customRadio.checked = true;
                        global.config[configKey] = event.target.value;
                        save();
                        generate();
                    });
                };

                setupBorderColorControls('config-grid', 'config-grid-custom-color', 'grid');
                setupBorderColorControls('config-board-border', 'config-board-border-custom-color', 'boardBorder');

                const cellShapeElements = uiElement.querySelectorAll('[name="config-cell-shape"]');
                const sizeModeElement = uiElement.querySelector('[name="config-size-mode"]');
                const depthSizeModeOption = sizeModeElement.querySelector('option[value="depth"]');
                const hexOrientationRow = uiElement.querySelector('#config-hex-orientation-row');
                const syncHexOrientationVisibility = () => {
                    const isHexagon = global.config.cellShape === 'hexagon';
                    hexOrientationRow.style.display = isHexagon ? '' : 'none';
                    depthSizeModeOption.hidden = !isHexagon;
                    if (!isHexagon && global.config.sizeMode === 'depth') {
                        global.config.sizeMode = 'grid';
                        sizeModeElement.value = global.config.sizeMode;
                    }
                    syncSizeMode();
                };
                cellShapeElements.forEach(input => {
                    input.checked = global.config.cellShape === input.value;
                    input.addEventListener('change', event => {
                        global.config.cellShape = event.target.value;
                        syncHexOrientationVisibility();
                        save();
                        generate();
                    });
                });
                syncHexOrientationVisibility();

                const hexOrientationElements = uiElement.querySelectorAll('[name="config-hex-orientation"]');
                hexOrientationElements.forEach(input => {
                    input.checked = global.config.hexOrientation === input.value;
                    input.addEventListener('change', event => {
                        global.config.hexOrientation = event.target.value;
                        save();
                        generate();
                    });
                });

            }

            window.onloadCounter = 0;
            const onloadResources = window.onloadResources = Object.fromEntries(
                Object.values(THEMES)
                    .flatMap(theme => Object.values(theme))
                    .filter(value => !value.startsWith('#'))
                    .map(url => [url, { url }])
            );
            function onloadSource(ev) {
                window.onloadCounter++;
                if (window.onloadCounter === Object.values(window.onloadResources).length){
                    ui();
                    generate();
                }
            }
            for ([key, data] of Object.entries(onloadResources)) {
                const img = onloadResources[key].img = new Image();
                img.onload = onloadSource;
                // A broken optional theme image must not stop the UI from
                // loading; it will simply render as its URL is unavailable.
                img.onerror = onloadSource;
                img.src = data.url;
            }
