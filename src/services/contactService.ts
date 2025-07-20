import { PrismaClient, Contact } from '@prisma/client';

const prisma = new PrismaClient();

interface IdentifyRequest {
    email?: string;
    phoneNumber?: string;
}

interface IdentifyResponse {
    contact: {
        primaryContatctId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

export class ContactService {
    public async identify(request: IdentifyRequest): Promise<IdentifyResponse> {
        const { email, phoneNumber } = request;

        if (!email && !phoneNumber) {
            throw new Error("Either email or phoneNumber must be provided.");
        }

        const existingContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    email ? { email: email } : {},
                    phoneNumber ? { phoneNumber: phoneNumber } : {},
                ],
                deletedAt: null,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        let primaryContacts: Contact[] = [];
        let secondaryContacts: Contact[] = [];
        let uniqueLinkedIds: Set<number> = new Set();

        for (const contact of existingContacts) {
            if (contact.linkPrecedence === "primary") {
                primaryContacts.push(contact);
            } else {
                secondaryContacts.push(contact);
                if (contact.linkedId) {
                    uniqueLinkedIds.add(contact.linkedId);
                }
            }
        }

        if (uniqueLinkedIds.size > 0) {
            const linkedPrimaryContacts = await prisma.contact.findMany({
                where: {
                    id: { in: Array.from(uniqueLinkedIds) },
                    linkPrecedence: "primary",
                    deletedAt: null,
                },
            });
            primaryContacts.push(...linkedPrimaryContacts);
        }

        primaryContacts = Array.from(new Map(primaryContacts.map(p => [p.id, p])).values())
                               .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (existingContacts.length === 0) {
            const newContact = await prisma.contact.create({
                data: {
                    email,
                    phoneNumber,
                    linkPrecedence: "primary",
                },
            });
            return this.buildResponse(newContact.id, [newContact]);
        }

        let primaryContactToReturn: Contact;

        if (primaryContacts.length === 0) {
            primaryContactToReturn = existingContacts[0];
            if (primaryContactToReturn.linkPrecedence === "secondary" && primaryContactToReturn.linkedId) {
                const linked = await prisma.contact.findUnique({ where: { id: primaryContactToReturn.linkedId } });
                if (linked) primaryContactToReturn = linked;
            }
        } else {
            primaryContactToReturn = primaryContacts[0];
        }

        let currentEmails = new Set<string>();
        let currentPhoneNumbers = new Set<string>();

        if (primaryContactToReturn.email) currentEmails.add(primaryContactToReturn.email);
        if (primaryContactToReturn.phoneNumber) currentPhoneNumbers.add(primaryContactToReturn.phoneNumber);

        const primaryId = primaryContactToReturn.id;
        const secondariesOfPrimary = await prisma.contact.findMany({
            where: {
                linkedId: primaryId,
                linkPrecedence: "secondary",
                deletedAt: null,
            },
        });
        secondariesOfPrimary.forEach(c => {
            if (c.email) currentEmails.add(c.email);
            if (c.phoneNumber) currentPhoneNumbers.add(c.phoneNumber);
        });

        if (primaryContacts.length > 1) {
            const otherPrimaryContactsToDemote = primaryContacts.filter(p => p.id !== primaryContactToReturn.id);

            for (const pc of otherPrimaryContactsToDemote) {
                const sharesInfoWithUltimatePrimary =
                    (pc.email && currentEmails.has(pc.email)) ||
                    (pc.phoneNumber && currentPhoneNumbers.has(pc.phoneNumber));

                if (sharesInfoWithUltimatePrimary) {
                    await prisma.contact.update({
                        where: { id: pc.id },
                        data: {
                            linkedId: primaryContactToReturn.id,
                            linkPrecedence: "secondary",
                        },
                    });
                    if (pc.email) currentEmails.add(pc.email);
                    if (pc.phoneNumber) currentPhoneNumbers.add(pc.phoneNumber);

                    await prisma.contact.updateMany({
                        where: {
                            linkedId: pc.id,
                            deletedAt: null,
                        },
                        data: {
                            linkedId: primaryContactToReturn.id,
                        },
                    });

                    const secondariesOfDemoted = await prisma.contact.findMany({
                        where: {
                            linkedId: pc.id,
                            deletedAt: null,
                        },
                    });
                    for (const sec of secondariesOfDemoted) {
                        if (sec.email) currentEmails.add(sec.email);
                        if (sec.phoneNumber) currentPhoneNumbers.add(sec.phoneNumber);
                    }
                }
            }
        }

        const isEmailNew = email && !currentEmails.has(email);
        const isPhoneNumberNew = phoneNumber && !currentPhoneNumbers.has(phoneNumber);

        const exactMatchExistsInConsolidated = existingContacts.some(c =>
            (c.email === email && c.phoneNumber === phoneNumber) ||
            (c.email === email && phoneNumber === null && c.phoneNumber === null) ||
            (c.phoneNumber === phoneNumber && email === null && c.email === null)
        );

        if ((isEmailNew || isPhoneNumberNew) && !exactMatchExistsInConsolidated) {
            const incomingEmailMatchesExisting = email && existingContacts.some(c => c.email === email);
            const incomingPhoneMatchesExisting = phoneNumber && existingContacts.some(c => c.phoneNumber === phoneNumber);

            if (incomingEmailMatchesExisting || incomingPhoneMatchesExisting) {
                await prisma.contact.create({
                    data: {
                        email,
                        phoneNumber,
                        linkedId: primaryContactToReturn.id,
                        linkPrecedence: "secondary",
                    },
                });
            }
        }

        const finalConsolidatedContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { id: primaryContactToReturn.id },
                    { linkedId: primaryContactToReturn.id }
                ],
                deletedAt: null,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        const updatedPrimaryContact = finalConsolidatedContacts.find(c => c.id === primaryContactToReturn.id) || primaryContactToReturn;

        return this.buildResponse(updatedPrimaryContact.id, finalConsolidatedContacts);
    }

    private buildResponse(
        primaryId: number,
        allContacts: Contact[]
    ): IdentifyResponse {
        const emails = new Set<string>();
        const phoneNumbers = new Set<string>();
        const secondaryContactIds = new Set<number>();

        let primaryContact: Contact | undefined;

        primaryContact = allContacts.find(c => c.id === primaryId && c.linkPrecedence === "primary");

        if (primaryContact) {
            if (primaryContact.email) emails.add(primaryContact.email);
            if (primaryContact.phoneNumber) phoneNumbers.add(primaryContact.phoneNumber);
        }

        allContacts.forEach(contact => {
            if (contact.linkPrecedence === "secondary") {
                if (contact.linkedId === primaryId) {
                    secondaryContactIds.add(contact.id);
                    if (contact.email) emails.add(contact.email);
                    if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
                }
            } else if (contact.linkPrecedence === "primary" && contact.id !== primaryId) {
                 secondaryContactIds.add(contact.id);
                 if (contact.email) emails.add(contact.email);
                 if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
            }
        });

        let sortedEmails = Array.from(emails).sort();
        let sortedPhoneNumbers = Array.from(phoneNumbers).sort();

        if (primaryContact?.email && sortedEmails.includes(primaryContact.email)) {
            sortedEmails.splice(sortedEmails.indexOf(primaryContact.email), 1);
            sortedEmails.unshift(primaryContact.email);
        }
        if (primaryContact?.phoneNumber && sortedPhoneNumbers.includes(primaryContact.phoneNumber)) {
            sortedPhoneNumbers.splice(sortedPhoneNumbers.indexOf(primaryContact.phoneNumber), 1);
            sortedPhoneNumbers.unshift(primaryContact.phoneNumber);
        }

        return {
            contact: {
                primaryContatctId: primaryId,
                emails: sortedEmails,
                phoneNumbers: sortedPhoneNumbers,
                secondaryContactIds: Array.from(secondaryContactIds).sort((a, b) => a - b),
            },
        };
    }
}
