# VibeLoop — Google Cloud monthly budget alert ($10 / 50% / 90% / 100%)
#
# Prerequisites:
#   1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
#   2. Run: gcloud auth login
#   3. Run: gcloud auth application-default login  (optional)
#
# Usage:
#   .\scripts\create-gcp-budget.ps1
#   .\scripts\create-gcp-budget.ps1 -BillingAccountId "012345-678901-ABCDEF"

param(
    [string]$BillingAccountId = "",
    [decimal]$BudgetUsd = 10,
    [string]$DisplayName = "VibeLoop Monthly Budget"
)

function Require-Gcloud {
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Error @"
gcloud CLI is not installed.

Install Google Cloud SDK:
  https://cloud.google.com/sdk/docs/install

Then run:
  gcloud auth login
  .\scripts\create-gcp-budget.ps1
"@
        exit 1
    }
}

Require-Gcloud

if (-not $BillingAccountId) {
    Write-Host "Fetching billing accounts..." -ForegroundColor Cyan
    $accounts = gcloud billing accounts list --format="value(name,displayName,open)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to list billing accounts. Run: gcloud auth login"
        exit 1
    }

    Write-Host $accounts
    Write-Host ""
    $BillingAccountId = Read-Host "Enter Billing Account ID (format: XXXXXX-XXXXXX-XXXXXX)"
}

if (-not $BillingAccountId) {
    Write-Error "Billing Account ID is required."
    exit 1
}

Write-Host "Creating budget: $DisplayName ($$BudgetUsd / month)..." -ForegroundColor Cyan

gcloud billing budgets create `
    --billing-account=$BillingAccountId `
    --display-name=$DisplayName `
    --budget-amount="${BudgetUsd}USD" `
    --threshold-rule=percent=0.5,basis=current-spent `
    --threshold-rule=percent=0.9,basis=current-spent `
    --threshold-rule=percent=1.0,basis=current-spent

if ($LASTEXITCODE -ne 0) {
    Write-Error "Budget creation failed."
    exit 1
}

Write-Host ""
Write-Host "Done. Budget alerts will email billing account admins at 50%, 90%, and 100%." -ForegroundColor Green
Write-Host "View budgets: https://console.cloud.google.com/billing/budgets" -ForegroundColor Green
