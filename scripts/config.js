console.log('npx http-server --cors');
            console.log('https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image');
            const CONFIG_MARGIN_X = 8.6; // mm, default = 8.6
            const CONFIG_MARGIN_Y = 8.6; // mm, default = 8.6
            const CONFIG_GRID_LINE_WIDTH = 12;
            const CONFIG_DIAMONDS = false;
            const CONFIG_CELL_PROPERTIES = [/*
                {
                    coord: [3, 3],
                    type: 'circle',
                    position: 'left top',
                    radius: 3, //mm
                },
                {
                    coord: [3, 6],
                    type: 'circle',
                    position: 'left top',
                    radius: 3, //mm
                },se
                {
                    coord: [6, 3],
                    type: 'circle',
                    position: 'left top',
                    radius: 3, //mm
                },
                {
                    coord: [6, 6],
                    type: 'circle',
                    position: 'left top',
                    radius: 3, //mm
                },
            */];
            const CONFIG_CENTER = true;
            // A theme entry may be a CSS colour (for example, a hex colour) or
            // an image URL.  Image URLs are loaded once at startup.
            const THEMES = {
                'Wood': {
                    light: './images/chessboard-wood-tile-light.png',
                    mid: './images/chessboard-wood-tile-mid.jpg',
                    dark: './images/chessboard-wood-tile-dark.png',
                    grid: './images/chessboard-wood-tile-dark.png',
                    boardBorder: './images/chessboard-wood-tile-dark.png'
                },
                'Black': { light: '#ffffff', mid: '#b0b0b0', dark: '#000000', grid: '#000000', boardBorder: '#000000' },
                'Red': { light: '#ffffff', mid: '#e58a8a', dark: '#aa0000', grid: '#aa0000', boardBorder: '#aa0000' },
                'Gray': { light: '#ffffff', mid: '#d7d7d7', dark: '#acacac', grid: '#acacac', boardBorder: '#acacac' },
                'Wikipedia': { light: '#ffce9e', mid: '#e8ab6f', dark: '#d18b47', grid: '#d18b47', boardBorder: '#d18b47' },
                'LiChess.org': { light: '#f0d9b5', mid: '#d9b58a', dark: '#b58863', grid: '#b58863', boardBorder: '#b58863' },
                'Chess.com': { light: '#ebecd0', mid: '#aebd91', dark: '#739552', grid: '#739552', boardBorder: '#739552' },
                'HexChess.com': { light: '#a5c8df', mid: '#80b1d0', dark: '#4180a9', grid: '#4180a9', boardBorder: '#4180a9' }
                
            };
            const config = {};
