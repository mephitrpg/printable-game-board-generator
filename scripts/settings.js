const defaultSettings = {
                config: {
                    size: { columns: 8, rows: 8, third: 8 },
                    sizeMode: 'grid',
                    cellsPerSide: 8,
                    hexOrientation: 'vertex',
                    baseSize: { columns: 8, rows: 8, third: 8 }, // reference dimensions for the guide grid
                    sameSize: 'contain',
                    showGuideGrid: true,
                    format: 'a4', // [95 + 95 + CONFIG_MARGIN_X, 95 + 95 + CONFIG_MARGIN_Y]; // default = 'a3', you can set custom size in mm. In example, to set postit size, use: [76, 76]
                    customFormat: { width: 210, height: 297 },
                    split: 2,
                    cellShape: 'square',
                    theme: 'Wood',
                    customTheme: { light: '#ffffff', mid: '#808080', dark: '#000000' },
                    customTextureTheme: { light: '', mid: '', dark: '' },
                    grid: '',
                    boardBorder: '#000000',
                    checkered: true,
                    inverted: false
                }
            };
            let global = {
                config: JSON.parse(JSON.stringify(defaultSettings.config))
            };