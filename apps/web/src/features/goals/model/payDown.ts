// "Pay down" on the Goals screen is the existing Loan Lab and payoff planner, unchanged. Re-exported
// here so the Goals UI builds against one model folder; their files stay in features/loan/model until
// MP14 moves the routes (#171, part 1).
export { useLoanLab } from '@/features/loan/model/useLoanLab';
export { usePayoffPlanner } from '@/features/loan/model/usePayoffPlanner';
