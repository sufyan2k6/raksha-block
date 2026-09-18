/* ==========================================================================
   RAKSHA BLOCK — RULE-BASED PRIORITY CALCULATION ENGINE
   Calculates Priority (Critical, High, Medium, Low) & Priority Reason on Backend
   ========================================================================== */

function calculatePriority({ urgency, asset_risk, traffic_impact, due_date, duration_minutes }) {
    const levelScore = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    
    const uScore = levelScore[urgency] || 1;
    const rScore = levelScore[asset_risk] || 1;
    const tScore = levelScore[traffic_impact] || 1;
    
    // Calculate Due Date Proximity Score
    let dateScore = 1;
    let daysUntilDue = null;
    if (due_date) {
        const due = new Date(due_date);
        const now = new Date();
        const diffMs = due - now;
        daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue <= 2) {
            dateScore = 3;
        } else if (daysUntilDue <= 5) {
            dateScore = 2;
        }
    }
    
    // Duration Score
    const durScore = (parseInt(duration_minutes, 10) > 240) ? 2 : 1;
    
    const totalScore = uScore + rScore + tScore + dateScore + durScore;
    
    let priority = 'Low';
    let reasons = [];
    
    if (uScore >= 3) reasons.push('elevated urgency');
    if (rScore >= 3) reasons.push('high asset risk');
    if (tScore >= 3) reasons.push('significant traffic impact');
    if (dateScore >= 2) reasons.push('approaching due date');
    if (durScore > 1) reasons.push('extended block duration requirement');

    if (totalScore >= 11 || uScore === 4 || rScore === 4) {
        priority = 'Critical';
    } else if (totalScore >= 8) {
        priority = 'High';
    } else if (totalScore >= 5) {
        priority = 'Medium';
    } else {
        priority = 'Low';
    }

    let priority_reason = reasons.length > 0
        ? `Assigned ${priority} priority due to ${reasons.join(', ')}.`
        : `Standard ${priority.toLowerCase()} priority based on routine maintenance risk parameters.`;

    return {
        priority,
        priority_reason,
        calculatedScore: totalScore
    };
}

module.exports = { calculatePriority };
