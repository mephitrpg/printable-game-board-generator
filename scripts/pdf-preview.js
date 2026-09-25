document.getElementById('pdf-preview-button').addEventListener('click', function(event) {
                event.preventDefault();
                if(this.value==='0') {
                    this.value = '1';
                    // This panel is hidden by the stylesheet by default.
                    document.getElementById('pdf-preview').style.display = 'block';
                    document.getElementById('main-grid').style.gridTemplateColumns = '1fr 1fr 1fr';
                    window.dispatchEvent(new Event('pdf-preview-requested'));
                } else {
                    this.value = '0';
                    document.getElementById('pdf-preview').style.display = 'none';
                    document.getElementById('main-grid').style.gridTemplateColumns = '1fr 1fr';
                }
            });