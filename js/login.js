/* ==========================================================================
   RAKSHA BLOCK — LOGIN SCRIPT (END-TO-END AUTHENTICATION)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
});

function quickFill(empId, password) {
    const empInput = document.getElementById('empIdInput');
    const passInput = document.getElementById('passwordInput');
    if (empInput) empInput.value = empId;
    if (passInput) passInput.value = password;

    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.classList.add('d-none');
}

function showLoginError(message) {
    const alertBox = document.getElementById('loginAlert');
    if (alertBox) {
        alertBox.textContent = message;
        alertBox.classList.remove('d-none');
    } else {
        alert(message);
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.classList.add('d-none');

    const empIdInput = document.getElementById('empIdInput');
    const passwordInput = document.getElementById('passwordInput');
    const employee_id = empIdInput?.value.trim();
    const password = passwordInput?.value.trim();

    if (!employee_id || !password) {
        showLoginError('Please enter Employee ID and Password.');
        return;
    }

    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Authenticating...';
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showLoginError(data.error || 'Invalid credentials. Please verify your Employee ID and password.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Sign In</span> <i class="bi bi-arrow-right"></i>';
            }
            return;
        }

        // Store user authentication session
        const empId = data.user.employee_id || data.user.employeeId;
        sessionStorage.setItem('raksha_token', data.token || `token_${empId}`);
        sessionStorage.setItem('raksha_emp_id', empId);
        sessionStorage.setItem('raksha_user_name', data.user.name);
        sessionStorage.setItem('raksha_user_role', data.user.role);
        sessionStorage.setItem('raksha_user_department', data.user.department);

        // Redirect to dashboard
        window.location.href = '/dashboard';
    } catch (err) {
        console.error('Login Error:', err);
        showLoginError('Network error connecting to authentication server.');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In</span> <i class="bi bi-arrow-right"></i>';
        }
    }
}
