How should assertions work?

We have lookahead (IFBefore) and lookback (IFAfter).
So 4 combinations:

Expr IfBefore Cond
Expr IfNotBefore Cond
Expr IfAfter Cond
Expr IfNotAfter Cond

A few things - either way Expr and Cond code should be
generated.  So we have something like the below for lookaheads
(and in reverse if for lookbacks).  Lookbacks also add an extra
complication that the lookback predicate may already have matched
another rule in a previous match and we are continuing on
here - is this a thing?).

LA':...
LA: Expr
LB: ...
LC: Cond
LC':...

We also assume a couple of things here.  THe "Cond" expresssion
will be forced to do a "shortest" match.  Consider the following:

(a|b)*(?=(a|b)*)

This is a pathological case which can only be resolved if the
condition was forced to be a shortest match so that the expr
can be chosen for a longest or eager match.

Here automatically if the prev failed we have a failure
so if we come here it means the above push succeded
and SP now points to after the lookahead
But the great thing is no thread in *this* VM
has moved past SP1 (ie SP saved in l0)
so depending on whether the lookahead was to "consume"
or not we can update the SP (in l0) to "advance"
ie a new thread with SP being the SP as of the push operation
this means we have the concept of the VM having a "position"
that it keeps track and we really want each "run" method
in a VM to return the endposition - which it does

Couple of things that could make this simpler.

"consume" can ONLY be when we have a lookahead and not in
lookback.
Looking further (pun intended) when is consume every necessary?
if consume was every required the only purpose would be
to "skip" the token becuase if the consume was to include
it as part of the expression then why even make it a lookahead?

So we can safely assume that consume is always false there by
always restarting after the PopState at the same point
that a PushSP was done at l0 - so a PushSP also may not be
required.

Can we use Push and Pop for other purposes like
backmatches?

eg if we wanted rust style raw strings:

('+).*(\1)?  (we need this to be greedy)

We need this to be:

LA: expr for '+
LB: PushState Consume = true
LC: Code for .*
LD: Code for \1 - but compiled dynamically from LA's result
LC: PopState

Unlke the previosu case *here* we want the stack pointer
to continue after PopState.  So perhaps we could make PopState
take a parameter to do consume or not
