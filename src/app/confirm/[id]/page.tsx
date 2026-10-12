"use client";
import { useParams } from "next/navigation";
import Confirmation from "../ConfirmationForm";
export default function EditConfirmation(){const params=useParams();return <Confirmation draftId={String(params.id)}/>;}
