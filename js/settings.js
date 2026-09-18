/* ==========================================================================
   RAKSHA BLOCK — SETTINGS SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    document.getElementById('btnSettingsSignOut')?.addEventListener('click', handleAppSignOut);
    document.getElementById('btnSavePreferences')?.addEventListener('click', () => {
        if (typeof showToast === 'function') {
            showToast('Preferences Saved', 'Personnel notification & operational preferences updated successfully.');
        } else {
            alert('Preferences saved successfully.');
        }
    });
});

function loadSettings() {
    const empId = sessionStorage.getItem('raksha_emp_id');
    const empName = sessionStorage.getItem('raksha_user_name');
    const empRole = sessionStorage.getItem('raksha_user_role');
    const empDept = sessionStorage.getItem('raksha_user_department');

    if (!empId || !empName) {
        sessionStorage.clear();
        window.location.href = '/';
        return;
    }

    if (document.getElementById('setEmpId')) document.getElementById('setEmpId').value = empId;
    if (document.getElementById('setEmpName')) document.getElementById('setEmpName').value = empName;
    if (document.getElementById('setEmpRole')) document.getElementById('setEmpRole').value = empRole || 'Staff';
    if (document.getElementById('setEmpDept')) document.getElementById('setEmpDept').value = empDept || 'Operations';
}
