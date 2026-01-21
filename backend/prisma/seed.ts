import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123456', 10);
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
      emailVerified: new Date(),
      preferences: {
        theme: 'light',
        notifications: true,
      },
    },
  });

  console.log(`✅ Created demo user: ${demoUser.email}`);

  // Create demo project
  const demoProject = await prisma.project.upsert({
    where: { 
      organizationId_slug: {
        organizationId: null as unknown as string,
        slug: 'demo-project',
      }
    },
    update: {},
    create: {
      name: 'Demo Project',
      description: 'A sample project to demonstrate AI Scrum Master capabilities',
      slug: 'demo-project',
      ownerId: demoUser.id,
      settings: {
        sprintDuration: 14,
        estimationType: 'story_points',
      },
    },
  });

  console.log(`✅ Created demo project: ${demoProject.name}`);

  // Add user as project member
  await prisma.projectMember.upsert({
    where: {
      userId_projectId: {
        userId: demoUser.id,
        projectId: demoProject.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      projectId: demoProject.id,
      role: 'OWNER',
    },
  });

  // Create sample epic
  const epic = await prisma.epic.create({
    data: {
      projectId: demoProject.id,
      title: 'User Authentication',
      description: 'Implement secure user authentication and authorization',
      status: 'ACTIVE',
      priority: 'HIGH',
      position: 0,
    },
  });

  console.log(`✅ Created epic: ${epic.title}`);

  // Create sample stories
  const stories = await Promise.all([
    prisma.story.create({
      data: {
        projectId: demoProject.id,
        epicId: epic.id,
        title: 'User Registration',
        description: 'As a new user, I want to register an account so I can access the platform',
        acceptanceCriteria: [
          'User can enter email and password',
          'Password validation rules are enforced',
          'Email verification is sent',
          'Success message is displayed',
        ],
        status: 'DONE',
        priority: 'HIGH',
        estimate: 5,
        confidence: 80,
        position: 0,
      },
    }),
    prisma.story.create({
      data: {
        projectId: demoProject.id,
        epicId: epic.id,
        title: 'User Login',
        description: 'As a registered user, I want to log in so I can access my account',
        acceptanceCriteria: [
          'User can enter credentials',
          'Invalid credentials show error',
          'Successful login redirects to dashboard',
          'Remember me option available',
        ],
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        estimate: 3,
        confidence: 90,
        position: 1,
        assigneeId: demoUser.id,
      },
    }),
    prisma.story.create({
      data: {
        projectId: demoProject.id,
        epicId: epic.id,
        title: 'Password Reset',
        description: 'As a user, I want to reset my password if I forget it',
        acceptanceCriteria: [
          'User can request password reset via email',
          'Reset link expires after 24 hours',
          'New password must meet security requirements',
        ],
        status: 'BACKLOG',
        priority: 'MEDIUM',
        estimate: 3,
        confidence: 70,
        position: 2,
      },
    }),
  ]);

  console.log(`✅ Created ${stories.length} stories`);

  // Create sample sprint
  const sprint = await prisma.sprint.create({
    data: {
      projectId: demoProject.id,
      name: 'Sprint 1',
      goal: 'Complete core authentication features',
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      status: 'ACTIVE',
      capacity: {
        [demoUser.id]: 40, // 40 hours
      },
    },
  });

  // Add stories to sprint
  await Promise.all(
    stories.slice(0, 2).map((story) =>
      prisma.sprintItem.create({
        data: {
          sprintId: sprint.id,
          storyId: story.id,
          originalEstimate: story.estimate,
        },
      }),
    ),
  );

  console.log(`✅ Created sprint: ${sprint.name}`);

  // Create sample insight
  await prisma.projectInsight.create({
    data: {
      projectId: demoProject.id,
      sprintId: sprint.id,
      insightType: 'VELOCITY',
      severity: 'INFO',
      title: 'Sprint on track',
      description: 'Current velocity matches planned capacity',
      aiExplanation: 'Based on completed story points and remaining sprint time, the team is on track to complete planned work.',
    },
  });

  console.log('✅ Created sample insight');

  console.log('\n🎉 Database seed completed successfully!');
  console.log('\n📝 Demo credentials:');
  console.log('   Email: demo@example.com');
  console.log('   Password: demo123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
