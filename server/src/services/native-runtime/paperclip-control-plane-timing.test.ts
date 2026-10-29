import { expect,it,vi } from "vitest";
import { PaperclipControlPlanePort } from "./paperclip-control-plane-port.js";
import { CONTROL_PLANE_CONFORMANCE_OPEN as OPEN,CONTROL_PLANE_CONFORMANCE_RESULT as result,CONTROL_PLANE_CONFORMANCE_TERMINAL as terminal } from "../../vendor/paperclip-runner/testing.js";

it.each([false,true])("marks result commitment only after the transaction resolves (failure=%s)",async(failed)=>{
 let resolve!:()=>void,reject!:(error:unknown)=>void;
 const transaction=vi.fn(()=>new Promise<void>((yes,no)=>{resolve=yes;reject=no;}));
 const committed=vi.fn(async()=>{});
 const port=new PaperclipControlPlanePort({transaction} as never,{...OPEN.identity,completionContractId:"fixture",completionContractSha256:"fixture",sourceInstanceId:"fixture",controlPlaneSourceInstanceId:"fixture"},{onResultCommitted:committed});
 const pending=port.completeRun({result,terminal});
 expect(transaction).toHaveBeenCalledOnce();expect(committed).not.toHaveBeenCalled();
 if(failed){const error=Error("transaction rejected");reject(error);await expect(pending).rejects.toBe(error);expect(committed).not.toHaveBeenCalled();}
 else{resolve();await pending;expect(committed).toHaveBeenCalledOnce();}
});
