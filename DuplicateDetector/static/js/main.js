document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const processButton = document.getElementById('processButton');
    const imagePreview = document.getElementById('imagePreview');
    const processing = document.getElementById('processing');
    const results = document.getElementById('results');
    const resultsSummary = document.getElementById('resultsSummary');
    const uniqueImagesList = document.getElementById('uniqueImagesList');
    const duplicateGroupsList = document.getElementById('duplicateGroupsList');

    let selectedFiles = [];

    function updateProcessButton() {
        processButton.disabled = selectedFiles.length === 0;
    }

    function addToPreview(files) {
        try {
            imagePreview.innerHTML = '';
            selectedFiles = [];

            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    selectedFiles.push(file);
                    const reader = new FileReader();
                    
                    reader.onerror = function(error) {
                        console.error('Error reading file:', file.name, error);
                        alert(`Error reading file: ${file.name}`);
                    };

                    reader.onload = function(e) {
                        try {
                            const img = document.createElement('img');
                            img.src = e.target.result;
                            img.classList.add('preview-image');
                            img.onerror = function() {
                                console.error('Error loading image:', file.name);
                                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="red">Error</text></svg>';
                            };
                            imagePreview.appendChild(img);
                        } catch (err) {
                            console.error('Error creating preview:', err);
                        }
                    };

                    reader.readAsDataURL(file);
                }
            });

            updateProcessButton();
        } catch (err) {
            console.error('Error in addToPreview:', err);
            alert('Error processing files. Please try again.');
        }
    }

    fileInput.addEventListener('change', (e) => {
        addToPreview(e.target.files);
    });

    folderInput.addEventListener('change', (e) => {
        addToPreview(e.target.files);
    });

    async function deleteDuplicates(original, duplicates, groupDiv) {
        try {
            const response = await fetch('/delete-duplicates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    original: original,
                    duplicates: duplicates
                })
            });

            if (!response.ok) {
                throw new Error('Failed to delete duplicates');
            }

            // Add original to unique images
            const originalFile = selectedFiles.find(f => f.name === original);
            if (originalFile) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(originalFile);
                img.classList.add('preview-image');
                uniqueImagesList.appendChild(img);
            }

            // Remove deleted files from selectedFiles
            duplicates.forEach(duplicate => {
                const index = selectedFiles.findIndex(f => f.name === duplicate);
                if (index > -1) {
                    selectedFiles.splice(index, 1);
                }
            });

            // Remove the duplicate group from display
            groupDiv.remove();
            updateDuplicateCount();

            return await response.json();
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    }

    function displayDuplicateGroups(duplicateGroups) {
        duplicateGroupsList.innerHTML = '';
        duplicateGroups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('duplicate-group', 'mb-3');
            
            // Create and append original image
            const originalFile = selectedFiles.find(f => f.name === group.original);
            if (originalFile) {
                const originalImg = document.createElement('img');
                originalImg.src = URL.createObjectURL(originalFile);
                originalImg.classList.add('preview-image', 'original', 'me-2');
                groupDiv.appendChild(originalImg);
            }

            // Create and append duplicate images
            const duplicateContainer = document.createElement('div');
            duplicateContainer.classList.add('duplicates-container');
            
            group.duplicates.forEach(duplicate => {
                const duplicateFile = selectedFiles.find(f => f.name === duplicate);
                if (duplicateFile) {
                    const duplicateImg = document.createElement('img');
                    duplicateImg.src = URL.createObjectURL(duplicateFile);
                    duplicateImg.classList.add('preview-image', 'duplicate', 'me-2');
                    duplicateContainer.appendChild(duplicateImg);
                }
            });
            
            groupDiv.appendChild(duplicateContainer);

            // Add delete button
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('btn', 'btn-danger', 'mt-2');
            deleteButton.innerHTML = '<i class="bi bi-trash"></i> Delete Duplicates';
            deleteButton.onclick = async () => {
                try {
                    await deleteDuplicates(group.original, group.duplicates, groupDiv);
                } catch (error) {
                    alert('Error deleting duplicates: ' + error.message);
                }
            };
            groupDiv.appendChild(deleteButton);

            duplicateGroupsList.appendChild(groupDiv);
        });
    }

    function hashImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    processButton.addEventListener('click', async () => {
        try {
            const files = [...document.getElementById('fileInput').files, 
                          ...document.getElementById('folderInput').files]
                          .filter(file => file.type.startsWith('image/'));
            
            if (files.length === 0) {
                alert('Please select some images first');
                return;
            }

            // Change preview heading
            document.querySelector('#preview h3').textContent = 'After Removing Duplicates';

            // Show processing state
            processing.classList.remove('d-none');
            results.classList.add('d-none');

            // Display images in preview
            imagePreview.innerHTML = '';
            uniqueImagesList.innerHTML = '';

            // Process each image
            const uniqueImages = new Map();
            const promises = files.map(file => {
                return hashImage(file).then(hash => {
                    if (!uniqueImages.has(hash)) {
                        uniqueImages.set(hash, file);
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const img = document.createElement('img');
                            img.src = e.target.result;
                            img.classList.add('preview-image');
                            imagePreview.appendChild(img);

                            const uniqueImg = img.cloneNode();
                            uniqueImg.classList.add('result-image');
                            uniqueImagesList.appendChild(uniqueImg);
                        };
                        reader.readAsDataURL(file);
                    }
                }).catch(err => {
                    console.error('Error processing image:', file.name, err);
                });
            });

            await Promise.all(promises);

            processing.classList.add('d-none');
            results.classList.remove('d-none');
            resultsSummary.textContent = `Found ${files.length} images, ${uniqueImages.size} unique`;
        } catch (err) {
            console.error('Error in process button click:', err);
            alert('An error occurred while processing images.');
            processing.classList.add('d-none');
        }
    });

    // Add delete all duplicates functionality
    document.getElementById('deleteAllDuplicatesBtn').addEventListener('click', async () => {
        const duplicateGroups = document.querySelectorAll('.duplicate-group');
        for (const group of duplicateGroups) {
            const deleteButton = group.querySelector('.btn-danger');
            if (deleteButton) {
                deleteButton.click();
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between deletions
            }
        }
    });

    function updateDuplicateCount() {
        const remainingGroups = duplicateGroupsList.querySelectorAll('.duplicate-group').length;
        if (remainingGroups === 0) {
            document.getElementById('deleteAllDuplicatesBtn').classList.add('d-none');
        }
        // Update results summary
        const totalDuplicates = document.querySelectorAll('.duplicate-group .duplicate').length;
        resultsSummary.textContent = `Found ${totalDuplicates} duplicates in ${selectedFiles.length} images`;
    }
});
