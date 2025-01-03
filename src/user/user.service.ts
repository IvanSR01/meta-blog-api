import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'
import { CreateUserDto } from './dto/create-user.dto'
import * as bcrypt from 'bcrypt'
import { dot } from 'node:test/reporters'

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User) private userRepository: Repository<User>
	) {}

	/**
	 * Find a user by ID
	 * @param {number} id - User ID
	 * @returns {Promise<User>} - User found
	 */
	async findOneById(id: number): Promise<User> {
		return await this.userRepository.findOne({
			where: { id: +id },
			relations: {
				likes: true,
				dislikes: true,
				favorites: true,
				subscriptions: true,
				subscribers: true,
				posts: true,
				comments: true
			}
		})
	}

	/**
	 * Find a user by email
	 * @param {string} email - User email
	 * @returns {Promise<User | null>} - User found or null
	 */
	async findOneByEmail(email: string) {
		return await this.userRepository.findOneBy({ email })
	}

	/**
	 * Find all users, optionally filtered by search term
	 * @param {string} [search] - Search term for first name or last name
	 * @returns {Promise<User[]>} - List of users
	 */
	async findAll(search?: string, limit?: number) {
		return await this.userRepository.find({
			where: {
				firstName: search ? search : undefined,
				lastName: search ? search : undefined
			},
			take: limit
		})
	}

	/**
	 * Create a new user
	 * @param {CreateUserDto} dto - Data transfer object for user creation
	 * @returns {Promise<User | ConflictException>} - Created user or conflict exception
	 */
	async createUser(dto: CreateUserDto) {
		const user = await this.findOneByEmail(dto.email)
		if (!user) {
			return await this.userRepository.save({
				...dto,
				likes: [],
				dislikes: [],
				favorites: [],
				subscriptions: [],
				subscribers: []
			})
		}
		return new ConflictException('Email or username is already in use')
	}

	/**
	 * Update user details
	 * @param {number} id - User ID
	 * @param {Partial<User>} dto - Partial user data to update
	 * @returns {Promise<any>} - Result of update operation
	 */
	async updateUser(id: number, dto: Partial<User>) {
		const user = await this.findOneById(id)

		if (!user) throw new NotFoundException('User not found')

		if (user.password !== dto.password)
			dto.password = await bcrypt.hash(dto.password, await bcrypt.genSalt(10))

		return await this.userRepository.update({ id }, dto)
	}

	/**
	 * Delete a user by ID
	 * @param {number} id - User ID
	 * @returns {Promise<any>} - Result of delete operation
	 */
	async deleteUser(id: number) {
		return await this.userRepository.delete({ id: id })
	}

	/**
	 * Toggle subscription between user and author
	 * @param {number} userId - User ID
	 * @param {number} authorId - Author ID
	 * @throws {NotFoundException} - If user or author not found
	 */
	async toggleSubscription(userId: number, authorId: number) {
		const user = await this.findOneById(userId)

		if (!user) throw new NotFoundException('User not found')

		const author = await this.findOneById(authorId)

		if (!author) throw new NotFoundException('Author not found')

		if (
			user.subscriptions &&
			user.subscriptions.some(user => user.id === author.id)
		) {
			user.subscriptions = user.subscriptions.filter(
				user => user.id !== author.id
			)
			author.subscriptions = author.subscriptions.filter(
				author => author.id !== user.id
			)
		} else {
			user.subscriptions.push(author)
			author.subscriptions.push(user)
		}

		await this.userRepository.save(user)
		await this.userRepository.save(author)
	}

	async toggleBanned(userId: number, comment?: string) {
		const user = await this.findOneById(userId)

		if (!user) throw new NotFoundException('User not found')

		if (user.accountInfo.status === 'banned') user.accountInfo.status = 'active'
		else {
			user.accountInfo.status = 'banned'
			user.accountInfo.comment = comment
		}

		return await this.userRepository.save(user)
	}

	async userToAdmin(userId: number) {
		const user = await this.findOneById(userId)

		if (!user) throw new NotFoundException('User not found')

		user.role === 'admin-level-one'

		return await this.userRepository.save(user)
	}
}
