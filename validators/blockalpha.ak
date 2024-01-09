use aiken/interval.{Finite}
use aiken/list.{filter, length}
use aiken/transaction.{Output, ScriptContext, Spend, Transaction, ValidityRange}
use aiken/transaction/credential.{from_verification_key}
use aiken/transaction/value.{AssetName, PolicyId, lovelace_of, quantity_of}
use alphabid/constants.{demarket_addr, demarket_pct}
use alphabid/types.{VerificationKeyHash}
use alphabid/utils.{
  check_address, check_amount, find_output, find_output_Winter,
  must_be_signed_by,
}

type Datum {
  policyId: PolicyId,
  assetName: AssetName,
  /// POSIX time in second, e.g. 1672843961000
  lock_until: POSIXTime,
  /// Owner's credentials
  bider: VerificationKeyHash,
  /// Beneficiary's credentials
  winter: VerificationKeyHash,
  smc_address: VerificationKeyHash,
  author: VerificationKeyHash,
  price: Int,
  royalties: Int,
}

type POSIXTime =
  Int

validator {
  fn bid(datum: Datum, _redeemer: Void, ctx: ScriptContext) {
    // In principle, scripts can be used for different purpose (e.g. minting
    // assets). Here we make sure it's only used when 'spending' from a eUTxO

    // Get transaction and purpose from ctx
    let ScriptContext { transaction, purpose } = ctx

    // Retrieve the outputs contained in the transaction
    let Transaction { outputs, .. } = transaction

    // Check to see if the signature in the newly created transaction matches the signature the seller posted to the previous contract
    let bider_sign = must_be_signed_by(transaction, datum.bider)

    when purpose is {
      Spend(_) ->
        when bider_sign is {
          True -> True

          False -> {
            let alphabid_fee: Int = demarket_pct * datum.price / 100

            if !must_start_after(transaction.validity_range, datum.lock_until) {
              let output_smc =
                find_output(
                  outputs,
                  datum.price,
                  from_verification_key(datum.smc_address),
                )

              let output_refund_ada =
                find_output(
                  outputs,
                  datum.price,
                  from_verification_key(datum.winter),
                )

              when output_smc is {
                Some(output) ->
                  lovelace_of(output.value) >= datum.price && quantity_of(
                    output.value,
                    datum.policyId,
                    datum.assetName,
                  ) == 1 && output_refund_ada != None

                None -> False
              }
            } else {
              let output_bider =
                find_output(
                  outputs,
                  datum.price,
                  from_verification_key(datum.bider),
                )

              // Search for output included in the transaction that satisfies the amount of money sent to the author and must be sent to the correct address
              let output_author =
                find_output(
                  outputs,
                  datum.royalties,
                  from_verification_key(datum.author),
                )

              // Search for the output contained in the transaction that satisfies the amount of money sent to the exchange and must be sent to the correct address
              let output_alphabid =
                find_output(outputs, alphabid_fee, demarket_addr())

              let output_Winter =
                find_output_Winter(
                  outputs,
                  datum.policyId,
                  datum.assetName,
                  from_verification_key(datum.winter),
                )

              let check_output: Bool =
                output_author != None && output_alphabid != None && output_bider != None && output_Winter != None

              if check_output {
                if datum.author == datum.bider {
                  // Find outputs that satisfy the seller's address and the amount must be greater than the royalty amount
                  let list_out =
                    filter(
                      outputs,
                      // The output is taken from the outputs contained in the transaction
                      fn(output) {
                        check_address(
                          output,
                          from_verification_key(datum.bider),
                        ) && check_amount(output, datum.royalties)
                      },
                    )
                  // If more than 2 outputs exist, check again
                  if length(list_out) >= 2 {
                    // Look for deals that satisfy the full amount the seller lists for their product
                    let list_bider =
                      filter(
                        list_out,
                        // The outputs are taken from the filtered outputs in the list_out variable above
                        fn(output) { check_amount(output, datum.price) },
                      )

                    // The contract will be accepted if the number of outputs sent to the seller checked in the list_seller variable is greater than or equal to one, otherwise the contract will reject the transaction.
                    length(list_bider) >= 1
                  } else {
                    // If the output number satisfying the amount transferred to the author (in the case of seller and author) is less than 2, the transaction will be rejected
                    False
                  }
                } else {
                  // If the buyer is not the seller and satisfies the above outputs, the transaction will be accepted
                  True
                }
              } else {
                False
              }
            }
          }
        }
      _ -> False
    }
  }
}

fn must_be_signed_by(transaction: Transaction, vk: VerificationKeyHash) {
  list.has(transaction.extra_signatories, vk)
}

fn must_start_after(range: ValidityRange, lock_expiration_time: POSIXTime) {
  when range.lower_bound.bound_type is {
    Finite(tx_earliest_time) -> lock_expiration_time <= tx_earliest_time
    _ -> False
  }
}
// test must_start_after_succeed_when_lower_bound_is_after() {
//   must_start_after(interval.after(2), 1)
// }

// test must_start_after_succeed_when_lower_bound_is_equal() {
//   must_start_after(interval.after(2), 2)
// }

// test must_start_after_fail_when_lower_bound_is_before() {
//   !must_start_after(interval.after(2), 3)
// }
