import React from "react";
import { ArrowRight, Check, Layers3, MessageCircle } from "lucide-react";
import { Badge } from "@/main/components/ui/badge";
import { AgentIcon } from "@/components/AgentIcon";
import { cn } from "@/lib/utils";
import type { AgentWizardTemplate } from "../types";

interface AgentWizardTemplatePanelProps {
	templates: AgentWizardTemplate[];
	selectedTemplateId: string | null;
	onSelectTemplate: (template: AgentWizardTemplate) => void;
	error: string | null;
}

const formatTemplateLabel = (value: string) =>
	value
		.replace(/-feature$/, "")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());

export const AgentWizardTemplatePanel: React.FC<
	AgentWizardTemplatePanelProps
> = ({ templates, selectedTemplateId, onSelectTemplate, error }) => {
	const blankTemplate = templates.find((template) => template.id === "blank");
	const starterTemplates = templates.filter(
		(template) => template.id !== "blank",
	);

	return (
		<div className="border-b bg-background">
			<div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-5 lg:p-6">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<h2 className="text-lg font-semibold tracking-tight">
							Choose how to build
						</h2>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Build from conversation or start with a prepared agent shape.
						</p>
					</div>
				</div>

				{error ? (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
						{error}
					</div>
				) : null}

				{blankTemplate ? (
					<section className="space-y-3">
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
								<MessageCircle size={15} />
							</div>
							<div>
								<h3 className="text-sm font-semibold">
									No template, build completely with your messages
								</h3>
								<p className="text-xs text-muted-foreground">
									Start with an empty draft and let chat shape the agent.
								</p>
							</div>
						</div>

						<button
							type="button"
							onClick={() => onSelectTemplate(blankTemplate)}
							className={cn(
								"group flex w-full items-center gap-4 rounded-lg border border-dashed bg-muted/20 p-4 text-left transition-all hover:border-primary/50 hover:bg-muted/30",
								selectedTemplateId === blankTemplate.id &&
									"border-primary bg-primary/5 shadow-sm shadow-primary/10",
							)}
						>
							<div className="flex h-14 w-14 shrink-0 items-center justify-center">
								<AgentIcon
									size={58}
									animation={
										selectedTemplateId === blankTemplate.id ? "happy" : "idle"
									}
									screenContent={{
										kind: "emoji",
										value: blankTemplate.icon,
										scale: 0.76,
									}}
								/>
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="text-base font-semibold">
										{blankTemplate.name}
									</p>
									<Badge variant="outline" className="bg-background/70">
										From scratch
									</Badge>
								</div>
								<p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
									Use chat to define the name, behavior, skills, tools, and
									constraints from an empty draft.
								</p>
							</div>
							<span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
								Start blank
								<ArrowRight size={14} />
							</span>
						</button>
					</section>
				) : null}

				<section className="space-y-3">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
							<Layers3 size={15} />
						</div>
						<div>
							<h3 className="text-sm font-semibold">Start with templates</h3>
							<p className="text-xs text-muted-foreground">
								Pick a starter and continue refining it in chat.
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2">
						{starterTemplates.map((template) => {
							const selected = selectedTemplateId === template.id;
							return (
								<button
									key={template.id}
									type="button"
									onClick={() => onSelectTemplate(template)}
									className={cn(
										"group overflow-hidden rounded-lg border bg-card/65 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card hover:shadow-md",
										selected && "border-primary bg-primary/5 shadow-primary/10",
									)}
								>
									<div className="flex gap-3 p-4">
										<div className="flex h-12 w-12 shrink-0 items-center justify-center">
											<AgentIcon
												size={52}
												animation={selected ? "happy" : "idle"}
												screenContent={{
													kind: "emoji",
													value: template.icon,
													scale: 0.76,
												}}
											/>
										</div>
										<div className="min-w-0 flex-1 space-y-3">
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold">
														{template.name}
													</p>
													<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
														{template.description}
													</p>
												</div>
												<span
													className={cn(
														"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-transparent transition-colors",
														selected
															? "border-primary bg-primary text-primary-foreground"
															: "border-border bg-background group-hover:border-primary/50",
													)}
												>
													<Check size={12} />
												</span>
											</div>

											<div className="space-y-1.5">
												<div className="flex flex-wrap gap-1">
													{template.featureNames.length > 0 ? (
														template.featureNames
															.slice(0, 3)
															.map((featureName) => (
																<Badge
																	key={featureName}
																	variant="outline"
																	className="max-w-full truncate bg-background/70 text-[10px]"
																>
																	{formatTemplateLabel(featureName)}
																</Badge>
															))
													) : (
														<Badge
															variant="outline"
															className="bg-background/70 text-[10px]"
														>
															Custom setup
														</Badge>
													)}
												</div>
												<div className="flex flex-wrap gap-1">
													{template.skillNames.length > 0 ? (
														template.skillNames.slice(0, 2).map((skillName) => (
															<Badge
																key={skillName}
																variant="secondary"
																className="max-w-full truncate text-[10px]"
															>
																{formatTemplateLabel(skillName)}
															</Badge>
														))
													) : (
														<span className="text-[11px] text-muted-foreground">
															No starter skills
														</span>
													)}
												</div>
											</div>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</section>
			</div>
		</div>
	);
};
