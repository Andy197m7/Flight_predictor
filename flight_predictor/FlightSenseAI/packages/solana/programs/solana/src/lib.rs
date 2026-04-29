use anchor_lang::prelude::*;

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

declare_id!("D7CUNAs5Gr4bCbYn4cBJiDUtVNJdCPwWQVaJVspjHCow");

#[program]
pub mod flightsense_solana {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>, 
        market_id: String,
        initial_prob_bps: u16 // Basis points (e.g. 5000 = 50%)
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.market_id = market_id;
        market.status = MarketStatus::Active;
        market.volume = 0;
        market.resolved_outcome = 0; // 0 = None

        // Initialize Virtual CPMM with significant depth to minimize slippage for small trades
        // We use virtual liquidity to seed the price without needing initial funding
        // 10,000 "Virtual SOL" depth
        let initial_liquidity = 10_000 * LAMPORTS_PER_SOL; 
        
        // P = no / (yes + no)  => yes/no ratio determines price
        // To support initial probability, we skew the pools:
        // Price YES = initial_prob_bps / 10000.
        // Price YES = no_pool / (yes_pool + no_pool).
        // Let Total = 2 * initial_liquidity.
        // no_pool = Total * (prob / 10000)
        // yes_pool = Total - no_pool.
        
        let total_virtual_liquidity = 2 * initial_liquidity;
        let no_pool = (total_virtual_liquidity as u128)
            .checked_mul(initial_prob_bps as u128).unwrap()
            .checked_div(10_000).unwrap() as u64;
            
        let yes_pool = (total_virtual_liquidity as u128)
            .checked_sub(no_pool as u128).unwrap() as u64;

        market.yes_pool = yes_pool;
        market.no_pool = no_pool;
        
        msg!("Market Initialized. Y: {}, N: {}", yes_pool, no_pool);
        
        Ok(())
    }

    pub fn resolve(ctx: Context<ResolveMarket>, outcome: Outcome) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.status = MarketStatus::Resolved;
        market.resolved_outcome = outcome as u8; // 0=Undecided, 1=Yes, 2=No
        msg!("Market resolved to {:?}", outcome);
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        let user = &ctx.accounts.user;

        require!(market.status == MarketStatus::Resolved, ErrorCode::MarketNotResolved);
        require!(!position.claimed, ErrorCode::AlreadyClaimed);

        let outcome = market.resolved_outcome;
        let mut payout_lamports: u64 = 0;

        // Binary Option Payout:
        // Winning Share = 1 SOL collateral
        // Losing Share = 0 SOL
        
        if outcome == 1 { // YES Won
            if position.yes_shares > 0 {
                payout_lamports = position.yes_shares;
            }
        } else if outcome == 2 { // NO Won
            if position.no_shares > 0 {
                payout_lamports = position.no_shares;
            }
        }

        if payout_lamports > 0 {
            // Check contract balance just in case
            let contract_balance = **market.to_account_info().lamports.borrow();
            if contract_balance < payout_lamports {
                 // Should not happen with correct CPMM, but safety check
                 payout_lamports = contract_balance;
            }

            **market.to_account_info().try_borrow_mut_lamports()? -= payout_lamports;
            **user.to_account_info().try_borrow_mut_lamports()? += payout_lamports;
            msg!("Claimed {} lamports", payout_lamports);
            
            // Profit = Payout - Total Cost Basis
            let total_cost = position.yes_cost_basis + position.no_cost_basis;
            let profit = (payout_lamports as i64) - (total_cost as i64);
            position.realized_pl = position.realized_pl.checked_add(profit).unwrap();
        } else {
             // Loss
             let total_cost = position.yes_cost_basis + position.no_cost_basis;
             position.realized_pl = position.realized_pl.checked_sub(total_cost as i64).unwrap();
        }

        position.claimed = true;
        Ok(())
    }

    // Buy YES: Input SOL -> Mint (YES+NO) -> Swap NO for YES -> Output YES
    pub fn buy(
        ctx: Context<Trade>,
        outcome: Outcome,
        amount_lamports: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        let _user = &ctx.accounts.user;

        require!(market.status == MarketStatus::Active, ErrorCode::MarketNotActive);
        require!(amount_lamports > 0, ErrorCode::AmountTooSmall);
        
        let k = (market.yes_pool as u128).checked_mul(market.no_pool as u128).unwrap();
        let tokens_out: u64;

        if outcome == Outcome::Yes {
            // Buy YES
            // Add 'amount' to NO pool (swap NO -> YES)
            let new_no_pool = (market.no_pool as u128).checked_add(amount_lamports as u128).unwrap();
            let new_yes_pool = k.checked_div(new_no_pool).unwrap(); 
            
            let delta_yes = (market.yes_pool as u128).checked_sub(new_yes_pool).unwrap() as u64;
            
            // Total YES user gets = amount (minted) + delta (swapped)
            tokens_out = amount_lamports.checked_add(delta_yes).unwrap();
            
            // Update Pools
            market.no_pool = new_no_pool as u64;
            market.yes_pool = new_yes_pool as u64;
            
            position.yes_shares = position.yes_shares.checked_add(tokens_out).unwrap();
            position.yes_cost_basis = position.yes_cost_basis.checked_add(amount_lamports).unwrap();
        } else {
            // Buy NO
            let new_yes_pool = (market.yes_pool as u128).checked_add(amount_lamports as u128).unwrap();
            let new_no_pool = k.checked_div(new_yes_pool).unwrap();
            
            let delta_no = (market.no_pool as u128).checked_sub(new_no_pool).unwrap() as u64;
            
            tokens_out = amount_lamports.checked_add(delta_no).unwrap();
            
            market.yes_pool = new_yes_pool as u64;
            market.no_pool = new_no_pool as u64;
            
            position.no_shares = position.no_shares.checked_add(tokens_out).unwrap();
            position.no_cost_basis = position.no_cost_basis.checked_add(amount_lamports).unwrap();
        }
        
        market.volume = market.volume.checked_add(amount_lamports).unwrap();

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: market.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount_lamports)?;

        Ok(())
    }

    // Sell YES: Input YES -> Swap YES for NO -> Burn (YES+NO) for SOL
    pub fn sell(
        ctx: Context<Sell>, 
        outcome: Outcome,
        tokens_to_sell: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        let user = &ctx.accounts.user;

        require!(market.status == MarketStatus::Active, ErrorCode::MarketNotActive);
        require!(tokens_to_sell > 0, ErrorCode::AmountTooSmall);
        
        let yes_pool = market.yes_pool as u128;
        let no_pool = market.no_pool as u128;
        let t = tokens_to_sell as u128;
        
        let swap_amount: u64;
        let sol_payout: u64;
        
        if outcome == Outcome::Yes {
            // Selling YES
            // Quadratic Solver: x^2 + b*x + c = 0
            // b = Y + N - T
            // c = - T * Y
            
            let b_term = (yes_pool + no_pool) as i128 - (t as i128);
            let c_term = - (t as i128 * yes_pool as i128);
            
            let discriminant = (b_term * b_term) - (4 * c_term);
            require!(discriminant >= 0, ErrorCode::MathError);
            
            let sqrt_d = (discriminant as f64).sqrt() as i128; // Using f64 sqrt is approximate but sufficient for large numbers
            
            // x = (-b + sqrt_d) / 2
            let x = (-b_term + sqrt_d) / 2;
            
            if x < 0 { return Err(ErrorCode::MathError.into()); }
            swap_amount = x as u64;
            
            // Execute Swap: Swap x YES -> y NO
            let k = yes_pool * no_pool;
            let new_yes_pool = yes_pool + (swap_amount as u128);
            let new_no_pool = k / new_yes_pool;
            let received_no = no_pool - new_no_pool;
            
            // Payout = tokens remaining (T - x) should equal received (y) (approx)
            let remaining_yes = tokens_to_sell - swap_amount;
            sol_payout = std::cmp::min(remaining_yes, received_no as u64);
             
            // Update Pools
            market.yes_pool = new_yes_pool as u64;
            market.no_pool = new_no_pool as u64;
            
            // Update Position
            position.yes_shares = position.yes_shares.checked_sub(tokens_to_sell).unwrap();
            
            // Proportional cost reduction
            let cost_reduction = if position.yes_shares > 0 {
                 (position.yes_cost_basis as u128 * tokens_to_sell as u128 / (position.yes_shares as u128 + tokens_to_sell as u128)) as u64 
            } else { position.yes_cost_basis };
             
            position.yes_cost_basis = position.yes_cost_basis.saturating_sub(cost_reduction);
            let profit = (sol_payout as i64) - (cost_reduction as i64);
            position.realized_pl = position.realized_pl.checked_add(profit).unwrap();

        } else {
             // Selling NO
             // b = N + Y - T
             // c = - T * N
            let b_term = (no_pool + yes_pool) as i128 - (t as i128);
            let c_term = - (t as i128 * no_pool as i128);
            
            let discriminant = (b_term * b_term) - (4 * c_term);
            let sqrt_d = (discriminant as f64).sqrt() as i128;
            let x = (-b_term + sqrt_d) / 2;
             
            swap_amount = x as u64;
             
            let k = yes_pool * no_pool;
            let new_no_pool = no_pool + (swap_amount as u128);
            let new_yes_pool = k / new_no_pool;
            let received_yes = yes_pool - new_yes_pool;
             
            let remaining_no = tokens_to_sell - swap_amount;
            sol_payout = std::cmp::min(remaining_no, received_yes as u64);
             
            market.no_pool = new_no_pool as u64;
            market.yes_pool = new_yes_pool as u64;
             
            position.no_shares = position.no_shares.checked_sub(tokens_to_sell).unwrap();
            
            let cost_reduction = if position.no_shares > 0 {
                 (position.no_cost_basis as u128 * tokens_to_sell as u128 / (position.no_shares as u128 + tokens_to_sell as u128)) as u64 
            } else { position.no_cost_basis };
             
            position.no_cost_basis = position.no_cost_basis.saturating_sub(cost_reduction);
            let profit = (sol_payout as i64) - (cost_reduction as i64);
            position.realized_pl = position.realized_pl.checked_add(profit).unwrap();
        }

        // Transfer SOL Payout
        **market.to_account_info().try_borrow_mut_lamports()? -= sol_payout;
        **user.to_account_info().try_borrow_mut_lamports()? += sol_payout;
        
        msg!("Sold {} tokens for {} SOL. Swap: {}", tokens_to_sell, sol_payout, swap_amount);

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(market_id: String, initial_prob_bps: u16)]
pub struct InitializeMarket<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + 32 + 64 + 8 + 8 + 8 + 1 + 1, // discriminator + authority + market_id + yes_pool + no_pool + volume + status + outcome
        seeds = [b"market", market_id.as_bytes()], 
        bump
    )]
    pub market: Account<'info, MarketAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome: Outcome, amount_lamports: u64)]
pub struct Trade<'info> {
    #[account(mut)]
    pub market: Account<'info, MarketAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1, // discriminator + owner + yes_shares + no_shares + yes_cost + no_cost + realized_pl + claimed
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()], 
        bump
    )]
    pub position: Account<'info, PositionAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome: Outcome, tokens_to_sell: u64)]
pub struct Sell<'info> {
    #[account(mut)]
    pub market: Account<'info, MarketAccount>,
    #[account(mut)]
    pub position: Account<'info, PositionAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut, has_one = authority)]
    pub market: Account<'info, MarketAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub market: Account<'info, MarketAccount>,
    #[account(
        mut, 
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()], 
        bump
    )]
    pub position: Account<'info, PositionAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
pub struct MarketAccount {
    pub authority: Pubkey,
    pub market_id: String,
    pub yes_pool: u64,   // Virtual Token Reserve for CPMM
    pub no_pool: u64,    // Virtual Token Reserve for CPMM
    pub volume: u64,
    pub status: MarketStatus,
    pub resolved_outcome: u8, // 0 = None, 1 = Yes, 2 = No
}

#[account]
pub struct PositionAccount {
    pub owner: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub yes_cost_basis: u64,
    pub no_cost_basis: u64,
    pub realized_pl: i64,
    pub claimed: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MarketStatus {
    Active,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    Yes,
    No,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Market is not active")]
    MarketNotActive,
    #[msg("Amount is too small")]
    AmountTooSmall,
    #[msg("Insufficient shares")]
    InsufficientShares,
    #[msg("Market is not resolved")]
    MarketNotResolved,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Math Error")]
    MathError,
    #[msg("Insufficient Liquidity")]
    InsufficientLiquidity,
}
