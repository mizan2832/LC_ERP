# Accounting requirements for the project SRS

- Saving LC Opening Expense or Document Release with GL Posted creates internal party-wise Accounts payables. Document Release books its recorded financing loan; margin is not booked twice.
- Bank & Customs Expense posts and unposts each saved cost row separately, creating the party payable for that row.
- Posted sources cannot be cancelled until GL is unposted. Active linked Accounts entries block unposting until those entries are cancelled or reversed. Existing downstream restrictions also apply.
- Saving a completed Duty Calculation creates one summary payable to DUTY-001, Government Duty, for the total actual duty and customs processing expenses. Each positive actual cost head receives a unique stable booking number under this payable. These detail bookings do not add a second liability.
- Active Accounts work linked to the duty payable, cost booking, or source blocks both duty modification/cancellation and linked landed-cost cancellation. Cancelling or reversing Accounts work removes this lock; existing downstream locks remain.
- Cancelling duty voids its payable and cost bookings. Booking numbers are never reassigned to another duty record. Drafts do not create Government bookings.
- Accounts integration currently uses internal ERP payable records and linked Accounts-entry/payment records. External accounting software is not connected.

- Every cancellation with an internal accounting impact records an append-only, balanced reversal linked to the original payable/posting. GL Unpost reverses its payable first; subsequent source cancellation does not duplicate the reversal. Original references and history are retained. Reposting creates a new payable/posting reference. Active Accounts work must be reversed/cancelled first. Accounting lines use internal source and party references pending external chart-of-accounts mapping.
